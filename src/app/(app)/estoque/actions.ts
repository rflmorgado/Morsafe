"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

export type RegistrarEntradaState = { error: string | null; success?: boolean };

/**
 * Registra uma compra (entrada de estoque). Só faz o INSERT em
 * `entradas_estoque` — o saldo (`estoque.saldo_atual`) e o custo médio
 * (`epis.custo_medio_atual`) são recalculados sozinhos pelo trigger
 * `fn_registrar_entrada_estoque` (ver morsafe-schema.sql), que também cria
 * a linha em `estoque` na primeira entrada de um EPI, pelo método de custo
 * médio ponderado já combinado com o Rafael (ver comentário no topo de
 * epis/actions.ts). O app nunca escreve direto em `estoque` nem em
 * `epis.custo_medio_atual` a partir daqui — só nessa tabela de origem.
 *
 * Mesmo nível de permissão de cadastrar/editar EPI ("encarregado"+): é uma
 * ação operacional de rotina, não mais sensível que isso.
 */
export async function registrarEntradaEstoque(
  _prevState: RegistrarEntradaState,
  formData: FormData,
): Promise<RegistrarEntradaState> {
  const epiId = String(formData.get("epi_id") ?? "").trim();
  const quantidadeRaw = String(formData.get("quantidade") ?? "");
  const precoUnitarioRaw = String(formData.get("preco_unitario") ?? "");
  const fornecedor = String(formData.get("fornecedor") ?? "").trim();
  const notaFiscal = String(formData.get("nota_fiscal") ?? "").trim();
  const dataCompra = String(formData.get("data_compra") ?? "").trim();

  if (!epiId) {
    return { error: "Selecione o EPI." };
  }

  const quantidade = Number(quantidadeRaw);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return { error: "Informe uma quantidade válida (maior que zero)." };
  }

  const precoUnitario = Number(precoUnitarioRaw.replace(",", "."));
  if (!Number.isFinite(precoUnitario) || precoUnitario < 0) {
    return { error: "Informe um preço unitário válido." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  // Confirma que o EPI é da MESMA empresa de quem está registrando, antes
  // de inserir — mesma checagem de posse já usada em colaboradores/EPIs/
  // estações, pra não depender só do RLS pra recusar um id de outra
  // empresa cliente.
  const { data: epi, error: epiError } = await supabase
    .from("epis")
    .select("nome, empresa_id, ativo")
    .eq("id", epiId)
    .maybeSingle();

  if (epiError || !epi || epi.empresa_id !== user.empresaId) {
    return { error: "EPI não encontrado." };
  }
  if (!epi.ativo) {
    return {
      error:
        "Este EPI está desativado — reative-o antes de registrar uma entrada de estoque.",
    };
  }

  const quantidadeArredondada = Math.round(quantidade);

  const { data: novaEntrada, error } = await supabase
    .from("entradas_estoque")
    .insert({
      empresa_id: user.empresaId,
      epi_id: epiId,
      quantidade: quantidadeArredondada,
      preco_unitario: precoUnitario,
      fornecedor: fornecedor || null,
      nota_fiscal: notaFiscal || null,
      criado_por: user.id,
      // Omite a chave quando vazio, em vez de mandar string vazia — deixa
      // o default `current_date` da coluna assumir a data de hoje.
      ...(dataCompra ? { data_compra: dataCompra } : {}),
    })
    .select("id")
    .single();

  if (error || !novaEntrada) {
    console.error("registrarEntradaEstoque:", error?.message);
    return {
      error: "Não foi possível registrar a entrada de estoque. Tente novamente.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "entradas_estoque",
    registroId: novaEntrada.id,
    acao: "entrada_registrada",
    usuarioId: user.id,
    detalhes: { nome: epi.nome, quantidade: quantidadeArredondada },
  });

  revalidatePath("/estoque");
  revalidatePath("/epis"); // custo médio do EPI pode ter mudado
  revalidatePath("/dashboard"); // card de estoque baixo (vw_estoque_baixo)
  return { error: null, success: true };
}

export type AtualizarLimiteState = { error: string | null; success?: boolean };

/**
 * Ajusta só o limite a partir do qual um EPI passa a contar como "estoque
 * baixo" (destaque nesta tela e no card do Dashboard) — nunca mexe no
 * saldo. Upsert com onConflict em epi_id (chave primária de `estoque`)
 * porque um EPI sem nenhuma entrada de compra ainda pode não ter linha
 * nessa tabela (só o trigger de entrada a cria automaticamente); aqui pode
 * ser a primeira vez que a linha passa a existir, com saldo 0 (default da
 * coluna). Como `saldo_atual` não entra no payload, um upsert sobre uma
 * linha já existente nunca sobrescreve o saldo — só `limite_alerta` muda.
 */
export async function atualizarLimiteAlerta(
  epiId: string,
  novoLimite: number,
): Promise<AtualizarLimiteState> {
  if (!Number.isFinite(novoLimite) || novoLimite < 0) {
    return { error: "Informe um limite de alerta válido (zero ou mais)." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const { data: epi, error: epiError } = await supabase
    .from("epis")
    .select("nome, empresa_id")
    .eq("id", epiId)
    .maybeSingle();

  if (epiError || !epi || epi.empresa_id !== user.empresaId) {
    return { error: "EPI não encontrado." };
  }

  const limiteArredondado = Math.round(novoLimite);

  const { error } = await supabase.from("estoque").upsert(
    {
      epi_id: epiId,
      empresa_id: user.empresaId,
      limite_alerta: limiteArredondado,
    },
    { onConflict: "epi_id" },
  );

  if (error) {
    console.error("atualizarLimiteAlerta:", error.message);
    return {
      error: "Não foi possível salvar o limite de alerta. Tente novamente.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "estoque",
    registroId: epiId,
    acao: "limite_atualizado",
    usuarioId: user.id,
    detalhes: { nome: epi.nome, limite: limiteArredondado },
  });

  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export type AjustarEstoqueState = { error: string | null; success?: boolean };

/**
 * Corrige o saldo de UM EPI a partir de contagem física — nunca escreve
 * direto em `estoque.saldo_atual` (ver comentário na criação da coluna,
 * morsafe-schema.sql: "nunca editar manualmente"). Só faz o INSERT em
 * `ajustes_estoque` — quem de fato atualiza o saldo é o trigger
 * `fn_registrar_ajuste_estoque` (ver morsafe-add-ajuste-estoque.sql),
 * mesmo raciocínio de registrarEntradaEstoque acima pra `entradas_estoque`.
 *
 * Usada pelo lápis de correção pontual na tela (um EPI por vez) — ver
 * AjustarSaldoButton. A contagem em lote do fechamento de mês usa
 * registrarContagemEstoque, logo abaixo.
 *
 * Mesmo nível de permissão de registrar entrada de estoque
 * ("encarregado"+, decidido com o Rafael em 21/10/2026): é quem de fato
 * conta o EPI fisicamente.
 */
export async function ajustarEstoque(
  _prevState: AjustarEstoqueState,
  formData: FormData,
): Promise<AjustarEstoqueState> {
  const epiId = String(formData.get("epi_id") ?? "").trim();
  const saldoContadoRaw = String(formData.get("saldo_contado") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!epiId) {
    return { error: "EPI não informado." };
  }

  const saldoContado = Number(saldoContadoRaw);
  if (!Number.isFinite(saldoContado) || saldoContado < 0) {
    return { error: "Informe um saldo contado válido (zero ou mais)." };
  }
  if (!motivo) {
    return { error: "Informe o motivo do ajuste." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const { data: epi, error: epiError } = await supabase
    .from("epis")
    .select("nome, empresa_id, ativo")
    .eq("id", epiId)
    .maybeSingle();

  if (epiError || !epi || epi.empresa_id !== user.empresaId) {
    return { error: "EPI não encontrado." };
  }
  if (!epi.ativo) {
    return {
      error:
        "Este EPI está desativado — reative-o antes de ajustar o estoque.",
    };
  }

  // Saldo anterior é só pro registro histórico (mostrado no log de
  // auditoria) — quem decide o saldo final é sempre saldo_novo, pelo
  // trigger. 0 aqui é o mesmo default da coluna estoque.saldo_atual (ver
  // morsafe-schema.sql), pro caso (raro) de um EPI sem nenhuma entrada de
  // compra ainda.
  const { data: linhaEstoque } = await supabase
    .from("estoque")
    .select("saldo_atual")
    .eq("epi_id", epiId)
    .maybeSingle();
  const saldoAnterior = linhaEstoque?.saldo_atual ?? 0;
  const saldoArredondado = Math.round(saldoContado);

  const { data: novoAjuste, error } = await supabase
    .from("ajustes_estoque")
    .insert({
      empresa_id: user.empresaId,
      epi_id: epiId,
      saldo_anterior: saldoAnterior,
      saldo_novo: saldoArredondado,
      motivo,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error || !novoAjuste) {
    console.error("ajustarEstoque:", error?.message);
    return {
      error: "Não foi possível registrar o ajuste de estoque. Tente novamente.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "ajustes_estoque",
    registroId: novoAjuste.id,
    acao: "ajuste_estoque_registrado",
    usuarioId: user.id,
    detalhes: {
      nome: epi.nome,
      saldoAnterior,
      saldoNovo: saldoArredondado,
      motivo,
    },
  });

  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export type ContagemEstoqueItem = { epiId: string; saldoContado: number };

export type ContagemEstoqueFalha = { epiNome: string; erro: string };

export type RegistrarContagemState = {
  error: string | null;
  ajustados?: number;
  semMudanca?: number;
  falhas?: ContagemEstoqueFalha[];
};

/**
 * Contagem de estoque em lote — pensada pro fechamento de mês: em vez de
 * corrigir EPI por EPI com o lápis (ajustarEstoque, acima), a tela lista
 * todo o catálogo ativo de uma vez (ver listEstoqueParaAjuste, em
 * lib/data/estoque.ts) e Rafael digita o que contou fisicamente de cada
 * um. Só os itens cujo valor contado DIFERE do saldo atual viram uma linha
 * em `ajustes_estoque` — quem contou e confirmou que bate não precisa
 * gerar ruído no histórico. Mesmo motivo (texto livre, ex.: "Contagem
 * mensal de outubro/2026") vale pra todo o lote.
 *
 * Insere UMA LINHA DE CADA VEZ (nunca um array só) — mesmo raciocínio de
 * importarEntradasEstoque/importarEpis: um item problemático não derruba
 * o lote inteiro.
 *
 * Mesmo nível de permissão de ajustarEstoque: "encarregado"+.
 */
export async function registrarContagemEstoque(
  itens: ContagemEstoqueItem[],
  motivo: string,
): Promise<RegistrarContagemState> {
  const motivoTexto = motivo.trim();
  if (!motivoTexto) {
    return {
      error:
        'Informe o motivo da contagem (ex.: "Contagem mensal de outubro/2026").',
    };
  }
  if (!itens.length) {
    return { error: "Preencha a contagem de ao menos um EPI." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const empresaId = user.empresaId;
  const epiIds = itens.map((i) => i.epiId);

  // Confirma que todo EPI citado é da MESMA empresa e está ativo — mesma
  // checagem de posse de sempre, numa única consulta (`in`), não uma por
  // item.
  const { data: episValidos, error: episError } = await supabase
    .from("epis")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .in("id", epiIds);

  if (episError) {
    console.error(
      "registrarContagemEstoque (checagem de EPIs):",
      episError.message,
    );
    return { error: "Não foi possível validar os EPIs. Tente novamente." };
  }

  const nomePorId = new Map((episValidos ?? []).map((e) => [e.id, e.nome]));

  const { data: linhasEstoque, error: estoqueError } = await supabase
    .from("estoque")
    .select("epi_id, saldo_atual")
    .eq("empresa_id", empresaId)
    .in("epi_id", epiIds);

  if (estoqueError) {
    console.error(
      "registrarContagemEstoque (saldo atual):",
      estoqueError.message,
    );
  }
  const saldoAtualPorId = new Map(
    (linhasEstoque ?? []).map((l) => [l.epi_id, l.saldo_atual]),
  );

  let ajustados = 0;
  let semMudanca = 0;
  const falhas: ContagemEstoqueFalha[] = [];

  for (const item of itens) {
    const nomeEpi = nomePorId.get(item.epiId);
    if (!nomeEpi) {
      falhas.push({
        epiNome: "EPI não encontrado",
        erro: "EPI não encontrado ou desativado",
      });
      continue;
    }
    if (!Number.isFinite(item.saldoContado) || item.saldoContado < 0) {
      falhas.push({ epiNome: nomeEpi, erro: "Quantidade contada inválida" });
      continue;
    }

    const saldoAnterior = saldoAtualPorId.get(item.epiId) ?? 0;
    const saldoNovo = Math.round(item.saldoContado);
    if (saldoNovo === saldoAnterior) {
      semMudanca++;
      continue;
    }

    const { data: novoAjuste, error } = await supabase
      .from("ajustes_estoque")
      .insert({
        empresa_id: empresaId,
        epi_id: item.epiId,
        saldo_anterior: saldoAnterior,
        saldo_novo: saldoNovo,
        motivo: motivoTexto,
        criado_por: user.id,
      })
      .select("id")
      .single();

    if (error || !novoAjuste) {
      console.error(
        `registrarContagemEstoque (${item.epiId}):`,
        error?.message,
      );
      falhas.push({ epiNome: nomeEpi, erro: "Não foi possível salvar este ajuste" });
      continue;
    }

    ajustados++;
  }

  if (ajustados > 0) {
    await registrarLogAuditoria({
      supabase,
      empresaId,
      tabela: "ajustes_estoque",
      registroId: empresaId,
      acao: "contagem_estoque_registrada",
      usuarioId: user.id,
      detalhes: {
        quantidade: ajustados,
        motivo: motivoTexto,
        falhas: falhas.length,
      },
    });
    revalidatePath("/estoque");
    revalidatePath("/dashboard");
  }

  return {
    error: null,
    ajustados,
    semMudanca,
    falhas: falhas.length > 0 ? falhas : undefined,
  };
}

export type ImportarEntradaEstoqueRow = {
  // Número da linha na planilha original (cabeçalho = linha 1, ver
  // resolvedRows em importar-estoque-button.tsx) — só pra poder apontar
  // exatamente qual linha falhou, mesmo raciocínio de ImportarEpiRow.
  linha: number;
  epiId: string;
  epiNome: string;
  quantidade: number;
  precoUnitario: number;
  fornecedor: string | null;
  notaFiscal: string | null;
  // null = deixa o default `current_date` da coluna assumir a data de hoje.
  dataCompra: string | null;
};

export type ImportarEntradaEstoqueFalha = {
  linha: number;
  epiNome: string;
  erro: string;
};

export type ImportarEstoqueState = {
  error: string | null;
  inserted?: number;
  falhas?: ImportarEntradaEstoqueFalha[];
};

/**
 * Importação em massa de entradas de estoque — pensada pro onboarding de
 * uma empresa nova: em vez de lançar item por item em "Registrar entrada de
 * estoque", a empresa manda a planilha do estoque que já tem e cada linha
 * vira uma entrada em `entradas_estoque`, exatamente como uma entrada
 * manual — o saldo e o custo médio de cada EPI são recalculados sozinhos
 * pelo mesmo trigger (fn_registrar_entrada_estoque, ver morsafe-schema.sql).
 *
 * Diferente de importarColaboradores (que cria setor/cargo novos na hora se
 * não encontrar), aqui o EPI referido em cada linha PRECISA já existir no
 * catálogo — a tela (importar-estoque-button.tsx) resolve o nome da
 * planilha contra a lista de EPIs ativos e marca como erro quem não bate
 * com nada. Por isso a ordem de onboarding de uma empresa nova é sempre:
 * 1) importar o catálogo de EPI, 2) importar o estoque inicial.
 *
 * Confirma de novo aqui, no servidor, que cada epiId citado pertence MESMO
 * a essa empresa e está ativo — numa única consulta (`in`), não uma por
 * linha — antes de inserir qualquer coisa: o id veio do cliente (mesmo que
 * a lista que ele escolheu já estivesse filtrada por empresa na tela), e o
 * padrão deste projeto é nunca confiar só nisso.
 *
 * Insere UMA LINHA DE CADA VEZ, nunca tudo num `.insert(array)` só — mesmo
 * raciocínio de importarEpis/importarColaboradores: uma linha problemática
 * não pode derrubar o lote inteiro.
 *
 * Exige papel "admin" — mesmo nível de importarEpis/importarColaboradores
 * (mais alto que uma entrada manual, "encarregado"): uma planilha ou um
 * mapeamento de coluna errado bagunça o estoque em massa de uma vez só.
 */
export async function importarEntradasEstoque(
  rows: ImportarEntradaEstoqueRow[],
): Promise<ImportarEstoqueState> {
  if (!rows.length) {
    return { error: "Nenhuma linha válida para importar." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const empresaId = user.empresaId;

  const { data: episValidos, error: episError } = await supabase
    .from("epis")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .in(
      "id",
      Array.from(new Set(rows.map((r) => r.epiId))),
    );

  if (episError) {
    console.error(
      "importarEntradasEstoque (checagem de EPIs):",
      episError.message,
    );
    return { error: "Não foi possível validar os EPIs. Tente novamente." };
  }

  const idsValidos = new Set((episValidos ?? []).map((e) => e.id));
  const falhas: ImportarEntradaEstoqueFalha[] = [];
  let inserted = 0;

  for (const r of rows) {
    if (!idsValidos.has(r.epiId)) {
      falhas.push({
        linha: r.linha,
        epiNome: r.epiNome,
        erro: "EPI não encontrado ou desativado",
      });
      continue;
    }

    const { error } = await supabase.from("entradas_estoque").insert({
      empresa_id: empresaId,
      epi_id: r.epiId,
      quantidade: r.quantidade,
      preco_unitario: r.precoUnitario,
      fornecedor: r.fornecedor,
      nota_fiscal: r.notaFiscal,
      criado_por: user.id,
      ...(r.dataCompra ? { data_compra: r.dataCompra } : {}),
    });

    if (error) {
      // 23514 = check_violation no Postgres — aqui é sempre quantidade > 0
      // ou preco_unitario >= 0, mas essas duas já são validadas na tela
      // antes de chegar aqui (ver importar-estoque-button.tsx); se ainda
      // assim acontecer (ex: planilha reaberta e reenviada depois de
      // editada por fora), a mensagem abaixo cobre o caso.
      const mensagem =
        error.code === "23514"
          ? "Quantidade ou preço unitário inválido."
          : "Não foi possível salvar esta linha.";
      console.error(`importarEntradasEstoque (linha ${r.linha}):`, error.message);
      falhas.push({ linha: r.linha, epiNome: r.epiNome, erro: mensagem });
      continue;
    }

    inserted++;
  }

  if (inserted > 0) {
    // "importado" já existe em ACAO_LABEL/descreverLogAuditoria (mesmo
    // rótulo genérico usado por importarEpis/importarColaboradores) — não
    // precisa de uma ação nova só pra isso.
    await registrarLogAuditoria({
      supabase,
      empresaId,
      tabela: "entradas_estoque",
      registroId: empresaId,
      acao: "importado",
      usuarioId: user.id,
      detalhes: { quantidade: inserted, falhas: falhas.length },
    });
    revalidatePath("/estoque");
    revalidatePath("/epis"); // custo médio dos EPIs pode ter mudado
    revalidatePath("/dashboard");
  }

  return {
    error: null,
    inserted,
    falhas: falhas.length > 0 ? falhas : undefined,
  };
}
