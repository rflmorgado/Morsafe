"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";
import {
  listEntregasEmPosse,
  type EntregaEmPosse,
} from "@/lib/data/movimentacoes";
import type {
  MotivoEntrega,
  MotivoDevolucao,
  DestinoDevolucao,
} from "@/types/database";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

// O ajuste de saldo de estoque (baixa na entrega, devolução no
// reaproveitamento) NÃO é mais feito aqui no código do app — ver
// fn_registrar_entrega() / fn_registrar_devolucao() no banco. O código
// antigo (função ajustarEstoque, removida) fazia um select seguido de
// update, em duas chamadas separadas: sujeito a race condition sob
// concorrência (dois registros do mesmo EPI ao mesmo tempo liam o mesmo
// saldo_atual e cada update sobrescrevia o do outro) e, pior, duplicava a
// baixa/devolução em cima do que a trigger do banco já fazia sozinha
// (trigger sempre rodou em todo insert em entregas/devolucoes — ver
// checkup de 30/09/2026, item 1). A trigger, sendo um único UPDATE
// atômico (ou INSERT ... ON CONFLICT), não tem essa race e agora é a
// ÚNICA responsável por mexer em `estoque` — ver morsafe-fix-checkup-estoque.sql.

export type RegistrarEntregaState = { error: string | null; success?: boolean };

// Formato de cada item dentro do campo "itens" do FormData (JSON) — ver
// comentário em registrar-entrega-button.tsx sobre por que itens viajam
// como JSON num campo só, em vez de nomes de campo por índice
// (epi_id_0, epi_id_1...): o número de itens é dinâmico (botão "+
// Adicionar outro item"), então um array serializado é mais simples de
// montar no cliente e de validar aqui do que inventar uma convenção de
// nomes indexados.
type ItemEntregaBruto = {
  epi_id?: unknown;
  motivo?: unknown;
  quantidade?: unknown;
};

/**
 * Registra uma ou mais entregas de EPI a um MESMO colaborador, de uma vez só
 * — pedido do Rafael, 06/10/2026 ("em uma integração, entregamos mais de um
 * tipo de EPI... 'adicione mais itens', pra não precisar abrir a tela várias
 * vezes"). Cada item vira sua PRÓPRIA linha em `entregas` (mantém o
 * raciocínio de "uma linha = um EPI", que é o que permite devolver um item
 * do lote sem mexer nos outros — ver entrega_vinculada_id em
 * registrarDevolucao), mas todas as linhas compartilham a mesma assinatura e
 * o mesmo grupo_entrega_id, pra tela de Relatórios/ficha saberem que vieram
 * do mesmo pedido (ver desenharBlocoEntregaAgrupada em
 * colaboradores/[id]/ficha/route.ts).
 *
 * custo_unitario_no_momento é sempre lido do cadastro do EPI no momento da
 * entrega (nunca digitado no formulário) — é um "retrato" do custo naquela
 * data, que não deve mudar depois mesmo que o custo médio do EPI mude no
 * catálogo.
 */
export async function registrarEntrega(
  _prevState: RegistrarEntregaState,
  formData: FormData,
): Promise<RegistrarEntregaState> {
  const colaboradorId = String(formData.get("colaborador_id") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  const hora = String(formData.get("hora") ?? "").trim();
  const assinaturaUrl = String(formData.get("assinatura_url") ?? "").trim();
  const itensRaw = String(formData.get("itens") ?? "").trim();

  if (!colaboradorId || !data || !hora) {
    return { error: "Preencha colaborador, data e hora." };
  }
  if (!assinaturaUrl) {
    return { error: "Colete a assinatura de confirmação do recebimento." };
  }

  let itensBrutos: ItemEntregaBruto[];
  try {
    itensBrutos = JSON.parse(itensRaw);
  } catch {
    return { error: "Itens da entrega inválidos. Feche e abra o formulário de novo." };
  }
  if (!Array.isArray(itensBrutos) || itensBrutos.length === 0) {
    return { error: "Adicione pelo menos um item à entrega." };
  }

  const itens: { epiId: string; motivo: MotivoEntrega; quantidade: number }[] = [];
  for (const bruto of itensBrutos) {
    const epiId = String(bruto.epi_id ?? "").trim();
    const motivo = String(bruto.motivo ?? "").trim() as MotivoEntrega;
    const quantidade = Number(bruto.quantidade ?? 1);
    if (!epiId || !motivo) {
      return { error: "Preencha o EPI e o motivo de todos os itens." };
    }
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      return {
        error: "Quantidade deve ser um número inteiro de pelo menos 1, em todos os itens.",
      };
    }
    itens.push({ epiId, motivo, quantidade });
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }
  const empresaId = user.empresaId;

  const supabase = await createClient();

  const epiIds = [...new Set(itens.map((i) => i.epiId))];
  const [{ data: colaborador }, { data: episData }] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("nome, status")
      // empresa_id reconfirmado aqui, não só pelo RLS — mesmo raciocínio
      // de epis/estoque/colaboradores/actions.ts (ver auditoria de
      // isolamento entre empresas, 06/10/2026): sem isso, um id de
      // colaborador de OUTRA empresa só dependeria do RLS pra não ser
      // aceito, e este projeto já teve RLS mal configurado sem policy
      // mais de uma vez (ver CLAUDE.md regra 2).
      .eq("empresa_id", empresaId)
      .eq("id", colaboradorId)
      .maybeSingle(),
    supabase
      .from("epis")
      .select("id, nome, ativo, custo_medio_atual")
      .eq("empresa_id", empresaId)
      .in("id", epiIds),
  ]);

  if (!colaborador || colaborador.status !== "ativo") {
    return { error: "Colaborador inválido ou já desligado." };
  }

  const episPorId = new Map((episData ?? []).map((e) => [e.id, e]));
  for (const item of itens) {
    const epi = episPorId.get(item.epiId);
    if (!epi || !epi.ativo) {
      return { error: "Um dos EPIs selecionados é inválido ou foi desativado." };
    }
  }

  // Sempre gerado, mesmo quando é um item só — assim nenhum outro lugar do
  // código que lê grupo_entrega_id precisa tratar "entrega avulsa" como um
  // caso especial (NULL só existe em registros de antes desta coluna
  // existir, nunca em entrega nova).
  const grupoEntregaId = crypto.randomUUID();

  const linhas = itens.map((item) => ({
    empresa_id: empresaId,
    colaborador_id: colaboradorId,
    epi_id: item.epiId,
    data,
    hora,
    motivo: item.motivo,
    quantidade: item.quantidade,
    assinatura_url: assinaturaUrl,
    custo_unitario_no_momento: episPorId.get(item.epiId)!.custo_medio_atual,
    criado_por: user.id,
    grupo_entrega_id: grupoEntregaId,
  }));

  // Um único INSERT com várias linhas — atômico (ou grava todas, ou
  // nenhuma): melhor do que N inserts separados em loop, que podiam parar no
  // meio (ex.: 2 de 3 itens gravados) e deixar o estoque/ficha num estado
  // inconsistente. A trigger de baixa de estoque (fn_registrar_entrega, "for
  // each row") dispara uma vez por linha dentro dessa mesma transação.
  let { data: novas, error } = await supabase
    .from("entregas")
    .insert(linhas)
    .select("id, epi_id, quantidade");

  // grupo_entrega_id é coluna nova (ver morsafe-add-grupo-entrega.sql) e,
  // enquanto o acesso ao Supabase do Rafael continuar bloqueado (sem como
  // aplicar a migração — 06/10/2026), ela ainda não existe em produção.
  // Mesmo raciocínio de getLimiteColaboradores em lib/data/empresas.ts: sem
  // este fallback, TODA entrega pararia de poder ser registrada — não só a
  // funcionalidade de vários itens — até a coluna existir. Detecta
  // especificamente esse erro (mensagem citando a coluna) e tenta de novo
  // sem ela: a entrega continua sendo gravada normalmente, só sem o
  // agrupamento visual na ficha, que passa a funcionar sozinho, sem precisar
  // mexer em mais nada, assim que a migração for aplicada.
  // error.code "42703" é o código padrão do Postgres pra "coluna não
  // existe" (undefined_column) — mais preciso do que testar um regex no
  // texto da mensagem (como era antes): um regex casa com QUALQUER erro
  // que mencione "grupo_entrega_id" no texto (ex.: erro de permissão numa
  // policy futura que cite essa coluna), o que engoliria silenciosamente
  // um erro real sem relação com a coluna não existir ainda. Mantém o
  // teste na mensagem como segunda confirmação, pra não cair num 42703/
  // PGRST204 de outra coluna qualquer. PGRST204 é o código que o
  // PostgREST devolve quando não acha a coluna no SCHEMA CACHE dele, sem
  // nem chegar no banco — confirmado como o código real em produção (ver
  // definirLimiteColaboradores, empresas/actions.ts); só testar 42703
  // deixava este fallback nunca disparar de verdade.
  if (
    error &&
    (error.code === "42703" || error.code === "PGRST204") &&
    /grupo_entrega_id/i.test(error.message ?? "")
  ) {
    const linhasSemGrupo = linhas.map(({ grupo_entrega_id: _grupo, ...resto }) => resto);
    ({ data: novas, error } = await supabase
      .from("entregas")
      .insert(linhasSemGrupo)
      .select("id, epi_id, quantidade"));
  }

  if (error || !novas || novas.length !== linhas.length) {
    console.error("registrarEntrega:", error?.message);
    return { error: "Não foi possível registrar a entrega. Tente novamente." };
  }

  // Um registro de auditoria por item — mesmo nível de detalhe que cada
  // entrega avulsa já tinha antes desta funcionalidade existir.
  await Promise.all(
    novas.map((nova) => {
      const epi = episPorId.get(nova.epi_id);
      return registrarLogAuditoria({
        supabase,
        empresaId,
        tabela: "entregas",
        registroId: nova.id,
        acao: "criado",
        usuarioId: user.id,
        detalhes: {
          nome: `${colaborador.nome} — ${epi?.nome ?? ""}`,
          quantidade: nova.quantidade,
        },
      });
    }),
  );

  revalidatePath("/movimentacoes");
  revalidatePath(`/colaboradores/${colaboradorId}`);
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export type RegistrarDevolucaoState = { error: string | null; success?: boolean };

/**
 * Registra a devolução de um EPI — sempre vinculada a uma entrega específica
 * ainda não devolvida (entrega_vinculada_id), nunca a um EPI "qualquer" do
 * catálogo. epi_id e quantidade do registro vêm sempre da entrega vinculada
 * (relidos do banco aqui, nunca do formulário), e colaborador_id é
 * conferido contra o colaborador_id da própria entrega antes de gravar —
 * ver comentário mais abaixo.
 *
 * Exige assinatura de confirmação (igual a registrarEntrega), colhida ali
 * mesmo ou na estação (ver registrar-devolucao-button.tsx) — inclusive
 * quando a devolução é "extraviado/não devolvido fisicamente": aqui a
 * assinatura vale como o colaborador confirmando a própria declaração de
 * perda, não a entrega física de um objeto.
 */
export async function registrarDevolucao(
  _prevState: RegistrarDevolucaoState,
  formData: FormData,
): Promise<RegistrarDevolucaoState> {
  const colaboradorId = String(formData.get("colaborador_id") ?? "").trim();
  const entregaVinculadaId = String(
    formData.get("entrega_vinculada_id") ?? "",
  ).trim();
  const epiId = String(formData.get("epi_id") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim() as MotivoDevolucao;
  const destino = String(formData.get("destino") ?? "").trim() as DestinoDevolucao;
  const devolvidoFisicamente = formData.get("devolvido_fisicamente") === "on";
  const data = String(formData.get("data") ?? "").trim();
  const assinaturaUrl = String(formData.get("assinatura_url") ?? "").trim();

  if (
    !colaboradorId ||
    !entregaVinculadaId ||
    !epiId ||
    !motivo ||
    !destino ||
    !data
  ) {
    return {
      error:
        "Selecione o colaborador, o EPI entregue, o motivo, o destino e a data.",
    };
  }
  if (!assinaturaUrl) {
    return { error: "Colete a assinatura de confirmação da devolução." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const [{ data: colaborador }, { data: entregaValida }] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("nome")
      // Mesma reconfirmação de empresa_id de registrarEntrega acima.
      .eq("empresa_id", user.empresaId)
      .eq("id", colaboradorId)
      .maybeSingle(),
    supabase
      .from("entregas")
      .select("colaborador_id, epi_id, quantidade, epis ( nome )")
      .eq("empresa_id", user.empresaId)
      .eq("id", entregaVinculadaId)
      .maybeSingle(),
  ]);

  if (!colaborador) return { error: "Colaborador não encontrado." };

  // A checagem que faltava: colaborador_id e entrega_vinculada_id chegam do
  // formulário como dois campos independentes, preenchidos a partir de dois
  // estados de UI diferentes (select de colaborador + item escolhido na
  // lista "em posse", carregada à parte via buscarEntregasEmPosse). Numa
  // troca rápida de colaborador com resposta de rede fora de ordem, essa
  // lista podia ficar mostrando por um instante os EPIs do colaborador
  // ANTERIOR (mitigado agora no cliente, ver registrar-devolucao-button.tsx)
  // — mas o servidor não pode depender só disso. Sem esta conferência aqui,
  // a devolução seria gravada vinculada ao colaborador errado numa tabela
  // imutável por design (CLAUDE.md, regra 3). Pelo mesmo motivo, epi_id e
  // quantidade nunca vêm do formulário: usamos sempre o que está de fato
  // gravado na entrega vinculada.
  if (!entregaValida || entregaValida.colaborador_id !== colaboradorId) {
    return {
      error:
        "Essa entrega não pertence (mais) ao colaborador selecionado. Feche e abra o formulário de novo.",
    };
  }

  // Trava contra devolver a mesma entrega duas vezes (double-submit, ou o
  // mesmo cenário de resposta fora de ordem citado acima) — cada entrega só
  // pode ter uma devolução vinculada.
  const { data: devolucaoExistente } = await supabase
    .from("devolucoes")
    .select("id")
    .eq("entrega_vinculada_id", entregaVinculadaId)
    .maybeSingle();
  if (devolucaoExistente) {
    return { error: "Esta entrega já foi devolvida anteriormente." };
  }

  const epi = entregaValida.epis as unknown as { nome: string } | null;
  if (!epi) return { error: "EPI não encontrado." };
  const epiIdReal = entregaValida.epi_id;
  const quantidadeReal = entregaValida.quantidade;

  const { data: nova, error } = await supabase
    .from("devolucoes")
    .insert({
      empresa_id: user.empresaId,
      colaborador_id: colaboradorId,
      epi_id: epiIdReal,
      entrega_vinculada_id: entregaVinculadaId,
      data,
      motivo,
      destino,
      devolvido_fisicamente: devolvidoFisicamente,
      assinatura_url: assinaturaUrl,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error || !nova) {
    console.error("registrarDevolucao:", error?.message);
    return {
      error: "Não foi possível registrar a devolução. Tente novamente.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "devolucoes",
    registroId: nova.id,
    acao: "criado",
    usuarioId: user.id,
    detalhes: {
      nome: `${colaborador.nome} — ${epi.nome}`,
      quantidade: quantidadeReal,
    },
  });

  revalidatePath("/movimentacoes");
  revalidatePath(`/colaboradores/${colaboradorId}`);
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export type RegistrarRecusaState = { error: string | null; success?: boolean };

/**
 * Registra a recusa de um colaborador em usar/receber um EPI — junto com o
 * motivo (obrigatório aqui mesmo sendo opcional no banco: sem o motivo, o
 * registro não serve pra nada em caso de fiscalização ou acidente).
 */
export async function registrarRecusa(
  _prevState: RegistrarRecusaState,
  formData: FormData,
): Promise<RegistrarRecusaState> {
  const colaboradorId = String(formData.get("colaborador_id") ?? "").trim();
  const epiId = String(formData.get("epi_id") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  const hora = String(formData.get("hora") ?? "").trim();
  const testemunha = String(formData.get("testemunha") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim();

  if (!colaboradorId || !epiId || !data || !hora) {
    return { error: "Preencha colaborador, EPI, data e hora." };
  }
  if (!observacoes) {
    return { error: "Descreva o motivo da recusa." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const [{ data: colaborador }, { data: epi }] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("nome, status")
      // Mesma reconfirmação de empresa_id de registrarEntrega acima.
      .eq("empresa_id", user.empresaId)
      .eq("id", colaboradorId)
      .maybeSingle(),
    supabase
      .from("epis")
      .select("nome, ativo")
      .eq("empresa_id", user.empresaId)
      .eq("id", epiId)
      .maybeSingle(),
  ]);

  if (!colaborador || colaborador.status !== "ativo") {
    return { error: "Colaborador inválido ou já desligado." };
  }
  if (!epi || !epi.ativo) {
    return { error: "EPI inválido ou desativado." };
  }

  const { data: nova, error } = await supabase
    .from("recusas")
    .insert({
      empresa_id: user.empresaId,
      colaborador_id: colaboradorId,
      epi_id: epiId,
      data,
      hora,
      testemunha: testemunha || null,
      observacoes,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error || !nova) {
    console.error("registrarRecusa:", error?.message);
    return { error: "Não foi possível registrar a recusa. Tente novamente." };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "recusas",
    registroId: nova.id,
    acao: "criado",
    usuarioId: user.id,
    detalhes: { nome: `${colaborador.nome} — ${epi.nome}` },
  });

  revalidatePath("/movimentacoes");
  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { error: null, success: true };
}

/**
 * Usado pelo formulário de devolução: ao escolher o colaborador, busca (via
 * Server Action, sem precisar de uma rota própria) os EPIs que ele tem "em
 * posse" pra popular o segundo select — ver comentário em
 * lib/data/movimentacoes.ts (listEntregasEmPosse).
 */
export async function buscarEntregasEmPosse(
  colaboradorId: string,
): Promise<EntregaEmPosse[]> {
  const user = await getCurrentUser();
  if (!user?.empresaId || !colaboradorId) return [];
  return listEntregasEmPosse(colaboradorId, user.empresaId);
}

/**
 * Usado pelo formulário de entrega: ao escolher o EPI, busca o saldo atual
 * em `estoque` pra avisar (sem bloquear — registrar a entrega é o que
 * importa pra conformidade com a NR-06, ver CLAUDE.md regra 4) quando a
 * quantidade digitada deixaria o saldo negativo. `null` aqui quer dizer
 * "esse EPI ainda não teve nenhuma movimentação de estoque" (a linha em
 * `estoque` só passa a existir na primeira entrada de compra ou na primeira
 * entrega — ver fn_registrar_entrega() em morsafe-fix-checkup-estoque.sql) —
 * diferente de saldo zero, então o formulário não deve tratar como "sem
 * estoque nenhum".
 */
export async function buscarSaldoEstoque(
  epiId: string,
): Promise<number | null> {
  const user = await getCurrentUser();
  if (!user?.empresaId || !epiId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estoque")
    .select("saldo_atual")
    .eq("empresa_id", user.empresaId)
    .eq("epi_id", epiId)
    .maybeSingle();

  if (error) {
    console.error("buscarSaldoEstoque:", error.message);
    return null;
  }
  return data?.saldo_atual ?? null;
}

export type ExcluirEntregaTesteState = { error: string | null; success?: boolean };

/**
 * Exclusão de uma entrega específica, já registrada por engano (dado de
 * TESTE) — segunda exceção deliberada e documentada à regra 3 do CLAUDE.md
 * (a primeira é resetarDadosEmpresa, em empresas/actions.ts). Só
 * super_admin, nunca admin/encarregado: diferente do reset de empresa, esta
 * ação mira UMA entrega sem apagar o resto do histórico — pensada pro caso
 * de um lançamento de teste feito sobre um colaborador real, onde resetar a
 * empresa inteira destruiria dado de verdade junto (ver conversa com o
 * Rafael, 05/10/2026 — 2 entregas de teste no Adauto, na ViniPlast).
 *
 * Duas travas, além da permissão:
 * 1. Exige digitar o nome do colaborador (mostrado na tela) como
 *    confirmação — mesmo raciocínio de resetarDadosEmpresa, adaptado de uma
 *    empresa inteira pra uma entrega só.
 * 2. Recusa se já existir uma devolução vinculada a esta entrega
 *    (devolucoes.entrega_vinculada_id). A FK é ON DELETE SET NULL, então o
 *    banco permitiria apagar mesmo assim — mas aí o histórico da devolução
 *    ficaria "órfão" (sem saber de qual entrega ela veio), o que foge do
 *    caso que esta função foi pensada pra resolver.
 *
 * Repõe `estoque.saldo_atual` manualmente antes de apagar: a baixa de
 * estoque na criação da entrega é feita por uma trigger no banco
 * (fn_registrar_entrega, só dispara em INSERT — ver
 * morsafe-fix-checkup-estoque.sql), sem contrapartida de DELETE. Esta é a
 * ÚNICA escrita direta em `estoque.saldo_atual` em todo o código do app —
 * todo o resto depende só da trigger, de propósito (ver comentário no topo
 * deste arquivo e em estoque/actions.ts) — porque é exatamente o que a
 * trigger não cobre.
 */
export async function excluirEntregaTeste(
  entregaId: string,
  nomeColaboradorDigitado: string,
): Promise<ExcluirEntregaTesteState> {
  const user = await getCurrentUser();
  if (!user || user.papel !== "super_admin") {
    return { error: SEM_PERMISSAO };
  }

  const admin = createAdminClient();

  const { data: entrega, error: buscaError } = await admin
    .from("entregas")
    .select(
      "id, empresa_id, colaborador_id, epi_id, quantidade, colaboradores ( nome ), epis ( nome )",
    )
    .eq("id", entregaId)
    .maybeSingle();

  if (buscaError || !entrega) {
    return { error: "Entrega não encontrada." };
  }

  const colaborador = entrega.colaboradores as unknown as { nome: string } | null;
  const epi = entrega.epis as unknown as { nome: string } | null;
  const colaboradorNome = colaborador?.nome ?? "";

  if (!colaboradorNome || nomeColaboradorDigitado.trim() !== colaboradorNome) {
    return { error: `Digite exatamente "${colaboradorNome}" para confirmar.` };
  }

  const { data: devolucaoVinculada } = await admin
    .from("devolucoes")
    .select("id")
    .eq("entrega_vinculada_id", entregaId)
    .maybeSingle();

  if (devolucaoVinculada) {
    return {
      error:
        "Essa entrega já tem uma devolução vinculada a ela — não é possível excluir por aqui.",
    };
  }

  // Leitura seguida de escrita porque supabase-js não faz
  // "saldo_atual = saldo_atual + x" num único update — aceitável aqui por
  // ser uma ação rara, de super_admin, não concorrente (diferente do
  // cenário de duas entregas simultâneas que motivou a trigger ser atômica).
  const { data: estoqueAtual } = await admin
    .from("estoque")
    .select("saldo_atual")
    .eq("epi_id", entrega.epi_id)
    .maybeSingle();

  if (estoqueAtual) {
    const { data: estoqueAtualizado, error: estoqueError } = await admin
      .from("estoque")
      .update({
        saldo_atual: estoqueAtual.saldo_atual + entrega.quantidade,
        atualizado_em: new Date().toISOString(),
      })
      .eq("epi_id", entrega.epi_id)
      .select("epi_id")
      .maybeSingle();

    if (estoqueError || !estoqueAtualizado) {
      console.error(
        "excluirEntregaTeste (repor estoque):",
        estoqueError?.message,
      );
      return {
        error: "Não foi possível repor o estoque. Nada foi apagado — tente novamente.",
      };
    }
  }

  const { data: apagada, error: deleteError } = await admin
    .from("entregas")
    .delete()
    .eq("id", entregaId)
    .select("id")
    .maybeSingle();

  if (deleteError || !apagada) {
    console.error("excluirEntregaTeste:", deleteError?.message);
    return { error: "Não foi possível excluir a entrega. Tente novamente." };
  }

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: entrega.empresa_id,
    tabela: "entregas",
    registroId: entregaId,
    acao: "entrega_teste_excluida",
    usuarioId: user.id,
    detalhes: {
      nome: `${colaboradorNome} — ${epi?.nome ?? ""}`,
      quantidade: entrega.quantidade,
    },
  });

  revalidatePath("/movimentacoes");
  revalidatePath(`/colaboradores/${entrega.colaborador_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/estoque");
  return { error: null, success: true };
}
