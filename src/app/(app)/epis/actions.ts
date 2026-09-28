"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

/**
 * custo_medio_atual aqui é só o valor de referência inicial, digitado à mão
 * (não existe compra registrada ainda). Decisão de produto (confirmada com
 * o Rafael): quando o módulo de Estoque/Movimentações for construído, cada
 * entrada em `entradas_estoque` (compra real, com preco_unitario e
 * quantidade) deve recalcular esse campo sozinha, pelo método de custo
 * médio ponderado — ex.: novoCusto = (saldoAtual * custoAtual + qtdNova *
 * precoNovo) / (saldoAtual + qtdNova). A partir daí este formulário deixa
 * de ser a fonte de verdade do custo médio; ele só continua editável aqui
 * pra casos sem histórico de compra nenhum (EPI recém-cadastrado).
 */
function parseCustoMedio(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Vida útil é uma estimativa interna de planejamento, não uma exigência
 * legal com prazo fixo (a NR-06 não define um período único de troca para
 * todo EPI — varia por tipo, uso e orientação do fabricante). Por isso o
 * campo é sempre opcional.
 */
function parseVidaUtilDias(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function buildEpiPayload(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "").trim();
  const exigeCa = formData.get("exige_ca") === "on";
  const ca = String(formData.get("ca") ?? "").trim();
  const caValidade = String(formData.get("ca_validade") ?? "").trim();
  const vidaUtilDiasRaw = String(formData.get("vida_util_dias") ?? "");
  const fornecedor = String(formData.get("fornecedor") ?? "").trim();
  const custoMedioRaw = String(formData.get("custo_medio_atual") ?? "");

  return {
    nome,
    tipo: tipo || null,
    exige_ca: exigeCa,
    ca: exigeCa ? ca || null : null,
    ca_validade: exigeCa && caValidade ? caValidade : null,
    vida_util_dias: parseVidaUtilDias(vidaUtilDiasRaw),
    fornecedor: fornecedor || null,
    custo_medio_atual: parseCustoMedio(custoMedioRaw),
    // usado só pra validação abaixo, não vai pro insert/update
    _exigeCaSemNumero: exigeCa && !ca,
  };
}

export type CreateEpiState = { error: string | null; success?: boolean };

export async function createEpi(
  _prevState: CreateEpiState,
  formData: FormData,
): Promise<CreateEpiState> {
  const payload = buildEpiPayload(formData);

  if (!payload.nome) {
    return { error: "Digite o nome do EPI." };
  }
  if (payload._exigeCaSemNumero) {
    return {
      error: 'Informe o número do C.A. ou desmarque "Exige C.A.".',
    };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const { _exigeCaSemNumero, ...dados } = payload;
  void _exigeCaSemNumero;

  const supabase = await createClient();
  const { data: novo, error } = await supabase
    .from("epis")
    .insert({
      empresa_id: user.empresaId,
      ...dados,
    })
    .select("id")
    .single();

  if (error || !novo) {
    console.error("createEpi:", error?.message);
    return { error: "Não foi possível salvar o EPI. Tente novamente." };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "epis",
    registroId: novo.id,
    acao: "criado",
    usuarioId: user.id,
    detalhes: { nome: dados.nome },
  });

  revalidatePath("/epis");
  return { error: null, success: true };
}

export type UpdateEpiState = { error: string | null; success?: boolean };

export async function updateEpi(
  _prevState: UpdateEpiState,
  formData: FormData,
): Promise<UpdateEpiState> {
  const id = String(formData.get("id") ?? "").trim();
  const payload = buildEpiPayload(formData);

  if (!id) {
    return { error: "EPI inválido." };
  }
  if (!payload.nome) {
    return { error: "Digite o nome do EPI." };
  }
  if (payload._exigeCaSemNumero) {
    return {
      error: 'Informe o número do C.A. ou desmarque "Exige C.A.".',
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const { _exigeCaSemNumero, ...dados } = payload;
  void _exigeCaSemNumero;

  const supabase = await createClient();

  // Confirma que o EPI é da MESMA empresa de quem está editando, antes de
  // tentar o update — mesma checagem já usada em colaboradores/estacoes,
  // pra não depender só do RLS pra recusar um id de outra empresa cliente.
  const { data: epiAtual, error: buscaError } = await supabase
    .from("epis")
    .select("empresa_id")
    .eq("id", id)
    .maybeSingle();

  if (buscaError || !epiAtual || epiAtual.empresa_id !== user.empresaId) {
    return { error: "EPI não encontrado." };
  }

  const { data, error } = await supabase
    .from("epis")
    .update(dados)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateEpi:", error.message);
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
    };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: um .update() que não bate com
  // nenhuma linha retorna error: null mesmo sem alterar nada.
  if (!data) {
    console.error("updateEpi: update não afetou nenhuma linha para id=", id);
    return {
      error:
        "Não foi possível confirmar a alteração. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: epiAtual.empresa_id,
    tabela: "epis",
    registroId: id,
    acao: "atualizado",
    usuarioId: user.id,
    detalhes: { nome: dados.nome },
  });

  revalidatePath("/epis");
  return { error: null, success: true };
}

export type ImportarEpiRow = {
  nome: string;
  tipo: string | null;
  exigeCa: boolean;
  ca: string | null;
  caValidade: string | null;
  custoMedioAtual: number;
  fornecedor: string | null;
  vidaUtilDias: number | null;
};

export type ImportarEpisState = { error: string | null; inserted?: number };

/**
 * Importação em massa do catálogo de EPI. Diferente de colaboradores, não
 * existe FK pra resolver ou criar no meio do caminho (tipo é uma coluna de
 * texto livre, não uma tabela separada) — o componente cliente já leu e
 * validou a planilha inteira, então esta action só confere permissão e
 * insere tudo de uma vez.
 *
 * Exige papel "admin" (um nível acima de criar/editar um único EPI, que pede
 * só "encarregado"): mesmo raciocínio de colaboradores — uma planilha ou um
 * mapeamento de coluna errado bagunça em massa, então essa ação fica
 * reservada a quem tem mais confiança na empresa.
 */
export async function importarEpis(
  rows: ImportarEpiRow[],
): Promise<ImportarEpisState> {
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
  const payload = rows.map((r) => ({
    empresa_id: user.empresaId as string,
    nome: r.nome,
    tipo: r.tipo,
    exige_ca: r.exigeCa,
    ca: r.ca,
    ca_validade: r.caValidade,
    custo_medio_atual: r.custoMedioAtual,
    fornecedor: r.fornecedor,
    vida_util_dias: r.vidaUtilDias,
  }));

  const { error, count } = await supabase
    .from("epis")
    .insert(payload, { count: "exact" });

  if (error) {
    console.error("importarEpis:", error.message);
    return { error: "Não foi possível importar os EPIs. Tente novamente." };
  }

  const inserted = count ?? payload.length;
  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "epis",
    registroId: user.empresaId,
    acao: "importado",
    usuarioId: user.id,
    detalhes: { quantidade: inserted },
  });

  revalidatePath("/epis");
  return { error: null, inserted };
}

export type DesativarEpiState = { error: string | null; success?: boolean };

/**
 * Desativação = soft delete (ativo -> false), nunca DELETE físico: EPIs já
 * usados em entregas/estoque não podem ser removidos do banco sem perder o
 * histórico de conformidade. Diferente do desligamento de colaborador, não
 * exige reautenticação nem download de ficha — desativar um item do catálogo
 * não carrega a mesma implicação trabalhista, então fica no mesmo nível de
 * permissão de criar/editar ("encarregado"+), não reservado a "admin".
 */
export async function desativarEpi(epiId: string): Promise<DesativarEpiState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const { data: epi, error: buscaError } = await supabase
    .from("epis")
    .select("nome, empresa_id")
    .eq("id", epiId)
    .maybeSingle();

  if (buscaError || !epi || epi.empresa_id !== user.empresaId) {
    return { error: "EPI não encontrado." };
  }

  const { data, error } = await supabase
    .from("epis")
    .update({ ativo: false })
    .eq("id", epiId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("desativarEpi:", error.message);
    return { error: "Não foi possível desativar o EPI. Tente novamente." };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: um .update() que não bate com
  // nenhuma linha retorna error: null mesmo sem desativar nada.
  if (!data) {
    console.error(
      "desativarEpi: update não afetou nenhuma linha para epiId=",
      epiId,
    );
    return {
      error:
        "Não foi possível confirmar a desativação. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: epi.empresa_id,
    tabela: "epis",
    registroId: epiId,
    acao: "desativado",
    usuarioId: user.id,
    detalhes: { nome: epi.nome },
  });

  revalidatePath("/epis");
  return { error: null, success: true };
}

export type ExcluirEpiState = { error: string | null; success?: boolean };

/**
 * Exclusão DEFINITIVA (DELETE físico) — diferente de desativar, que é soft
 * delete. Pensada pro EPI que foi substituído por outro e nunca mais vai
 * ser usado, ou que foi cadastrado por engano, e não precisa mais ocupar o
 * catálogo (mesmo desativado).
 *
 * Duas travas antes de excluir:
 * 1) Só é permitido em cima de um EPI já desativado (ativo = false) — a
 *    interface só oferece essa opção depois da desativação.
 * 2) Se existir histórico de ENTREGA, DEVOLUÇÃO ou RECUSA vinculado, o
 *    próprio banco recusa a exclusão via FK RESTRICT — aqui só traduzimos
 *    esse erro (código Postgres 23503) numa mensagem clara. Essas três são
 *    as únicas tabelas que realmente importam pra conformidade com a
 *    NR-06, porque só elas ligam um trabalhador específico a um EPI
 *    específico numa data específica — a prova de que o EPI foi (ou não)
 *    entregue. Um EPI com qualquer uma dessas PRECISA continuar existindo
 *    no banco; só é seguro excluir de verdade um EPI que nunca chegou a
 *    ser entregue a ninguém.
 *
 * Antes dessa checagem, apaga de propósito `estoque` (saldo atual),
 * `setor_epi` (obrigatoriedade por setor) e `entradas_estoque` (compras
 * registradas) ligados a esse EPI. Nenhuma dessas é histórico de
 * conformidade — são só estado atual/controle de compra e estoque, sem
 * nenhum trabalhador vinculado — então não faz sentido travar a exclusão
 * do catálogo por causa delas (foi exatamente uma compra de teste que
 * travou um EPI duplicado que o Rafael queria limpar, sem nunca ter sido
 * entregue a ninguém).
 *
 * Exige papel "admin" — mais alto que desativar/reativar ("encarregado"),
 * porque, ao contrário daqueles, esta ação não tem volta.
 */
export async function excluirEpiDefinitivamente(
  epiId: string,
): Promise<ExcluirEpiState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const { data: epi, error: epiError } = await supabase
    .from("epis")
    .select("ativo, nome")
    .eq("id", epiId)
    .maybeSingle();

  if (epiError || !epi) {
    return { error: "EPI não encontrado." };
  }
  if (epi.ativo) {
    return {
      error: "Só é possível excluir definitivamente um EPI que já está desativado.",
    };
  }

  // Estado atual/controle de compra e estoque, não histórico de
  // conformidade — pode sumir junto com o EPI.
  await supabase.from("estoque").delete().eq("epi_id", epiId);
  await supabase.from("setor_epi").delete().eq("epi_id", epiId);
  await supabase.from("entradas_estoque").delete().eq("epi_id", epiId);

  const { error: deleteError } = await supabase
    .from("epis")
    .delete()
    .eq("id", epiId);

  if (deleteError) {
    if (deleteError.code === "23503") {
      return {
        error:
          "Não é possível excluir: este EPI tem histórico de entrega, devolução ou recusa vinculado a um colaborador. Pra preservar a conformidade com a NR-06, mantenha-o desativado.",
      };
    }
    console.error("excluirEpiDefinitivamente:", deleteError.message);
    return { error: "Não foi possível excluir o EPI. Tente novamente." };
  }

  if (user.empresaId) {
    await registrarLogAuditoria({
      supabase,
      empresaId: user.empresaId,
      tabela: "epis",
      registroId: epiId,
      acao: "excluido",
      usuarioId: user.id,
      detalhes: { nome: epi.nome },
    });
  }

  revalidatePath("/epis");
  return { error: null, success: true };
}

export type ReativarEpiState = { error: string | null; success?: boolean };

export async function reativarEpi(epiId: string): Promise<ReativarEpiState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const { data: epi, error: buscaError } = await supabase
    .from("epis")
    .select("nome, empresa_id")
    .eq("id", epiId)
    .maybeSingle();

  if (buscaError || !epi || epi.empresa_id !== user.empresaId) {
    return { error: "EPI não encontrado." };
  }

  const { data, error } = await supabase
    .from("epis")
    .update({ ativo: true })
    .eq("id", epiId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("reativarEpi:", error.message);
    return { error: "Não foi possível reativar o EPI. Tente novamente." };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: um .update() que não bate com
  // nenhuma linha retorna error: null mesmo sem reativar nada.
  if (!data) {
    console.error(
      "reativarEpi: update não afetou nenhuma linha para epiId=",
      epiId,
    );
    return {
      error:
        "Não foi possível confirmar a reativação. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: epi.empresa_id,
    tabela: "epis",
    registroId: epiId,
    acao: "reativado",
    usuarioId: user.id,
    detalhes: { nome: epi.nome },
  });

  revalidatePath("/epis");
  return { error: null, success: true };
}
