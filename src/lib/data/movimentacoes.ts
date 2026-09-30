import { createClient } from "@/lib/supabase/server";

// Rótulos (MOTIVO_ENTREGA_LABEL etc.) e o tipo TipoMovimentacao moram em
// movimentacoes-labels.ts, sem depender de Supabase/next/headers, pra poder
// ser importados direto por componentes cliente — mesma ideia de
// TIPOS_EPI/epi-tipos.ts em epis.ts. Reexportados aqui só por conveniência
// de quem já importa deste arquivo do lado do servidor.
export {
  MOTIVO_ENTREGA_LABEL,
  MOTIVO_DEVOLUCAO_LABEL,
  DESTINO_DEVOLUCAO_LABEL,
} from "./movimentacoes-labels";
export type { TipoMovimentacao } from "./movimentacoes-labels";
import {
  MOTIVO_ENTREGA_LABEL,
  MOTIVO_DEVOLUCAO_LABEL,
  DESTINO_DEVOLUCAO_LABEL,
  type TipoMovimentacao,
} from "./movimentacoes-labels";

export const MOVIMENTACOES_PAGE_SIZE = 20;

export type MovimentacaoEvento = {
  id: string;
  tipo: TipoMovimentacao;
  data: string;
  hora: string | null;
  criadoEm: string;
  colaboradorId: string;
  colaboradorNome: string;
  epiNome: string;
  epiCa: string | null;
  motivoLabel: string;
  detalhe: string | null;
  // Só entrega e devolução têm quantidade (uma recusa não entrega nada). Na
  // devolução, vem da entrega vinculada — devolver sempre baixa a
  // quantidade inteira daquela entrega, não um número digitado à parte (ver
  // comentário em listEntregasEmPosse mais abaixo).
  quantidade?: number;
};

type EpiEmbed = { nome: string; ca: string | null } | null;
type ColaboradorEmbed = { id: string; nome: string } | null;
type EntregaLigadaEmbed = { quantidade: number } | null;

export type ListMovimentacoesOptions = {
  // `empresaId` filtra explicitamente — antes dependia só do RLS pra
  // isolar (mesmo raciocínio de listColaboradores/listEpis em
  // colaboradores.ts/epis.ts): `null` quer dizer "sem empresa
  // identificada" e retorna lista vazia direto, sem consultar o banco.
  empresaId: string | null;
  tipo?: TipoMovimentacao;
  colaboradorId?: string;
  epiId?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
};

/**
 * Busca as três tabelas de movimentação (entregas, devoluções, recusas) já
 * filtradas, mapeadas para um formato único — mesma ideia de
 * getColaboradorDetalhe (lib/data/colaboradores.ts), mas aqui trazendo a
 * empresa inteira em vez de só um colaborador, e com filtros próprios da
 * tela de Movimentações. Quando "tipo" está definido, só a tabela
 * correspondente é consultada (evita 2 queries desnecessárias).
 */
async function buscarEventos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    empresaId,
    tipo,
    colaboradorId,
    epiId,
    dataInicio,
    dataFim,
  }: Omit<ListMovimentacoesOptions, "page" | "empresaId"> & {
    // Não-nulo aqui de propósito: os dois chamadores (listMovimentacoes,
    // listMovimentacoesParaExportar) já retornam cedo com lista vazia
    // quando empresaId é null, antes de chegar aqui.
    empresaId: string;
  },
): Promise<MovimentacaoEvento[]> {
  const eventos: MovimentacaoEvento[] = [];

  if (!tipo || tipo === "entrega") {
    let q = supabase
      .from("entregas")
      .select(
        "id, data, hora, motivo, quantidade, criado_em, colaboradores ( id, nome ), epis ( nome, ca )",
      )
      .eq("empresa_id", empresaId);
    if (colaboradorId) q = q.eq("colaborador_id", colaboradorId);
    if (epiId) q = q.eq("epi_id", epiId);
    if (dataInicio) q = q.gte("data", dataInicio);
    if (dataFim) q = q.lte("data", dataFim);
    const { data, error } = await q;
    if (error) console.error("listMovimentacoes (entregas):", error.message);
    for (const e of data ?? []) {
      const colaborador = e.colaboradores as unknown as ColaboradorEmbed;
      const epi = e.epis as unknown as EpiEmbed;
      eventos.push({
        id: `entrega-${e.id}`,
        tipo: "entrega",
        data: e.data,
        hora: e.hora,
        criadoEm: e.criado_em,
        colaboradorId: colaborador?.id ?? "",
        colaboradorNome: colaborador?.nome ?? "—",
        epiNome: epi?.nome ?? "—",
        epiCa: epi?.ca ?? null,
        motivoLabel: MOTIVO_ENTREGA_LABEL[e.motivo] ?? e.motivo,
        detalhe: null,
        quantidade: e.quantidade,
      });
    }
  }

  if (!tipo || tipo === "devolucao") {
    let q = supabase
      .from("devolucoes")
      .select(
        "id, data, motivo, destino, devolvido_fisicamente, criado_em, colaboradores ( id, nome ), epis ( nome, ca ), entregas ( quantidade )",
      )
      .eq("empresa_id", empresaId);
    if (colaboradorId) q = q.eq("colaborador_id", colaboradorId);
    if (epiId) q = q.eq("epi_id", epiId);
    if (dataInicio) q = q.gte("data", dataInicio);
    if (dataFim) q = q.lte("data", dataFim);
    const { data, error } = await q;
    if (error) console.error("listMovimentacoes (devolucoes):", error.message);
    for (const d of data ?? []) {
      const colaborador = d.colaboradores as unknown as ColaboradorEmbed;
      const epi = d.epis as unknown as EpiEmbed;
      const entregaLigada = d.entregas as unknown as EntregaLigadaEmbed;
      eventos.push({
        id: `devolucao-${d.id}`,
        tipo: "devolucao",
        data: d.data,
        hora: null,
        criadoEm: d.criado_em,
        colaboradorId: colaborador?.id ?? "",
        colaboradorNome: colaborador?.nome ?? "—",
        epiNome: epi?.nome ?? "—",
        epiCa: epi?.ca ?? null,
        motivoLabel: MOTIVO_DEVOLUCAO_LABEL[d.motivo] ?? d.motivo,
        detalhe: `${DESTINO_DEVOLUCAO_LABEL[d.destino] ?? d.destino}${
          d.devolvido_fisicamente ? "" : " · não devolvido fisicamente"
        }`,
        quantidade: entregaLigada?.quantidade,
      });
    }
  }

  if (!tipo || tipo === "recusa") {
    let q = supabase
      .from("recusas")
      .select(
        "id, data, hora, testemunha, observacoes, criado_em, colaboradores ( id, nome ), epis ( nome, ca )",
      )
      .eq("empresa_id", empresaId);
    if (colaboradorId) q = q.eq("colaborador_id", colaboradorId);
    if (epiId) q = q.eq("epi_id", epiId);
    if (dataInicio) q = q.gte("data", dataInicio);
    if (dataFim) q = q.lte("data", dataFim);
    const { data, error } = await q;
    if (error) console.error("listMovimentacoes (recusas):", error.message);
    for (const r of data ?? []) {
      const colaborador = r.colaboradores as unknown as ColaboradorEmbed;
      const epi = r.epis as unknown as EpiEmbed;
      eventos.push({
        id: `recusa-${r.id}`,
        tipo: "recusa",
        data: r.data,
        hora: r.hora,
        criadoEm: r.criado_em,
        colaboradorId: colaborador?.id ?? "",
        colaboradorNome: colaborador?.nome ?? "—",
        epiNome: epi?.nome ?? "—",
        epiCa: epi?.ca ?? null,
        motivoLabel: "Recusa registrada",
        detalhe: r.observacoes
          ? r.testemunha
            ? `${r.observacoes} · testemunha: ${r.testemunha}`
            : r.observacoes
          : r.testemunha
            ? `Testemunha: ${r.testemunha}`
            : null,
      });
    }
  }

  // Mais recente primeiro: data (a coluna que a pessoa realmente escolheu no
  // formulário) manda; criado_em só desempata quando duas movimentações
  // caem no mesmo dia.
  eventos.sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? 1 : -1;
    return a.criadoEm < b.criadoEm ? 1 : -1;
  });

  return eventos;
}

/**
 * Listagem paginada, unificada e ordenada das três tabelas de movimentação
 * (entrega/devolução/recusa) — o mesmo raciocínio de "buscar tudo que bate
 * com o filtro, ordenar em memória e só então paginar" usado em
 * listColaboradores, necessário aqui porque a ordenação cruza três tabelas
 * diferentes.
 */
export async function listMovimentacoes({
  empresaId,
  tipo,
  colaboradorId,
  epiId,
  dataInicio,
  dataFim,
  page = 1,
}: ListMovimentacoesOptions): Promise<{
  eventos: MovimentacaoEvento[];
  total: number;
}> {
  if (!empresaId) return { eventos: [], total: 0 };

  const supabase = await createClient();
  const eventos = await buscarEventos(supabase, {
    empresaId,
    tipo,
    colaboradorId,
    epiId,
    dataInicio,
    dataFim,
  });

  const total = eventos.length;
  const currentPage = page > 0 ? page : 1;
  const from = (currentPage - 1) * MOVIMENTACOES_PAGE_SIZE;
  const to = from + MOVIMENTACOES_PAGE_SIZE;

  return { eventos: eventos.slice(from, to), total };
}

/**
 * Mesma busca e os mesmos filtros de listMovimentacoes, mas sem paginação —
 * usada pela exportação em CSV.
 */
export async function listMovimentacoesParaExportar(
  options: Omit<ListMovimentacoesOptions, "page">,
): Promise<MovimentacaoEvento[]> {
  const { empresaId } = options;
  if (!empresaId) return [];
  const supabase = await createClient();
  return buscarEventos(supabase, { ...options, empresaId });
}

export type ColaboradorAtivo = { id: string; nome: string };

/**
 * Colaboradores ativos, para os selects dos formulários de registro — só
 * quem está ativo pode receber, devolver ou recusar um EPI; um colaborador
 * já desligado não aparece nessas opções.
 */
export async function listColaboradoresAtivos(
  empresaId: string | null,
): Promise<ColaboradorAtivo[]> {
  if (!empresaId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("colaboradores")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .eq("status", "ativo")
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("listColaboradoresAtivos:", error?.message);
    return [];
  }
  return data;
}

export type EpiAtivo = {
  id: string;
  nome: string;
  ca: string | null;
  custoMedioAtual: number;
};

/**
 * EPIs ativos, para os selects dos formulários de registro — mesmo
 * raciocínio de listColaboradoresAtivos: um EPI desativado sai do catálogo
 * corrente e não deve mais ser oferecido em novas movimentações.
 */
export async function listEpisAtivos(
  empresaId: string | null,
): Promise<EpiAtivo[]> {
  if (!empresaId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("epis")
    .select("id, nome, ca, custo_medio_atual")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("listEpisAtivos:", error?.message);
    return [];
  }
  return data.map((e) => ({
    id: e.id,
    nome: e.nome,
    ca: e.ca,
    custoMedioAtual: e.custo_medio_atual,
  }));
}

/**
 * Colaboradores e EPIs para os SELECTS DE FILTRO da tela de Movimentações —
 * diferente de listColaboradoresAtivos/listEpisAtivos (usadas nos
 * formulários de registro), aqui entram TODOS, ativos ou não: uma
 * movimentação antiga de um colaborador já desligado, ou de um EPI já
 * desativado, continua existindo no histórico e precisa continuar filtrável.
 */
export async function listColaboradoresParaFiltro(
  empresaId: string | null,
): Promise<ColaboradorAtivo[]> {
  if (!empresaId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("colaboradores")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("listColaboradoresParaFiltro:", error?.message);
    return [];
  }
  return data;
}

export type EpiParaFiltro = { id: string; nome: string };

export async function listEpisParaFiltro(
  empresaId: string | null,
): Promise<EpiParaFiltro[]> {
  if (!empresaId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("epis")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("listEpisParaFiltro:", error?.message);
    return [];
  }
  return data;
}

export type EntregaEmPosse = {
  id: string;
  data: string;
  motivoLabel: string;
  epiId: string;
  epiNome: string;
  epiCa: string | null;
  // Quantidade original entregue — a devolução baixa essa entrega por
  // inteiro (não suporta devolução parcial de uma mesma entrega), então o
  // formulário de devolução usa esse valor tanto para mostrar na lista
  // quanto para creditar de volta ao estoque a quantidade certa.
  quantidade: number;
};

/**
 * EPIs que um colaborador tem "em posse" — entregas dele que ainda não têm
 * nenhuma devolução vinculada (devolucoes.entrega_vinculada_id). Alimenta o
 * select de "qual EPI está sendo devolvido" no formulário de devolução: em
 * vez de escolher um EPI qualquer do catálogo, a pessoa escolhe a entrega
 * específica que está sendo baixada — o que preserva o vínculo
 * entrega->devolução no banco e é o mesmo raciocínio de rastreabilidade já
 * usado no resto do app.
 */
export async function listEntregasEmPosse(
  colaboradorId: string,
  empresaId: string | null,
): Promise<EntregaEmPosse[]> {
  if (!colaboradorId || !empresaId) return [];
  const supabase = await createClient();

  const [{ data: entregas, error: entregasError }, { data: devolucoes }] =
    await Promise.all([
      supabase
        .from("entregas")
        .select("id, data, motivo, epi_id, quantidade, epis ( nome, ca )")
        .eq("empresa_id", empresaId)
        .eq("colaborador_id", colaboradorId)
        .order("data", { ascending: false }),
      supabase
        .from("devolucoes")
        .select("entrega_vinculada_id")
        .eq("empresa_id", empresaId)
        .eq("colaborador_id", colaboradorId)
        .not("entrega_vinculada_id", "is", null),
    ]);

  if (entregasError || !entregas) {
    console.error("listEntregasEmPosse:", entregasError?.message);
    return [];
  }

  const jaDevolvidas = new Set(
    (devolucoes ?? []).map((d) => d.entrega_vinculada_id),
  );

  return entregas
    .filter((e) => !jaDevolvidas.has(e.id))
    .map((e) => {
      const epi = e.epis as unknown as EpiEmbed;
      return {
        id: e.id,
        data: e.data,
        motivoLabel: MOTIVO_ENTREGA_LABEL[e.motivo] ?? e.motivo,
        epiId: e.epi_id,
        epiNome: epi?.nome ?? "—",
        epiCa: epi?.ca ?? null,
        quantidade: e.quantidade,
      };
    });
}
