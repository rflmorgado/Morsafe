import { createClient } from "@/lib/supabase/server";

export const EPIS_PAGE_SIZE = 20;

// Lista de categorias fixas mora em epi-tipos.ts (sem depender do cliente
// Supabase de servidor) para poder ser importada por componentes cliente.
// Reexportada aqui só por conveniência de quem já importa deste arquivo.
export { TIPOS_EPI } from "./epi-tipos";

const SORT_COLUMNS = ["nome", "tipo", "custo_medio", "status"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function isSortColumn(value: string | undefined): value is SortColumn {
  return !!value && (SORT_COLUMNS as readonly string[]).includes(value);
}

// Nome da coluna ordenável (usado na URL/tela) -> coluna real na tabela.
const SORT_DB_COLUMN: Record<SortColumn, string> = {
  nome: "nome",
  tipo: "tipo",
  custo_medio: "custo_medio_atual",
  status: "ativo",
};

export type ListEpisOptions = {
  query?: string;
  tipo?: string;
  status?: string;
  sort?: string;
  dir?: string;
  page?: number;
};

export type Epi = {
  id: string;
  nome: string;
  tipo: string | null;
  ca: string | null;
  exigeCa: boolean;
  caValidade: string | null;
  vidaUtilDias: number | null;
  fornecedor: string | null;
  custoMedioAtual: number;
  ativo: boolean;
};

function buildEpisQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    query,
    tipo,
    status,
    sort,
    dir,
    count,
  }: Pick<ListEpisOptions, "query" | "tipo" | "status" | "sort" | "dir"> & {
    count?: "exact";
  },
) {
  let request = supabase
    .from("epis")
    .select(
      "id, nome, tipo, ca, exige_ca, ca_validade, vida_util_dias, fornecedor, custo_medio_atual, ativo",
      count ? { count } : undefined,
    );

  if (query && query.trim()) {
    request = request.ilike("nome", `%${query.trim()}%`);
  }
  if (tipo) {
    request = request.eq("tipo", tipo);
  }
  if (status === "ativo") {
    request = request.eq("ativo", true);
  } else if (status === "inativo") {
    request = request.eq("ativo", false);
  }

  const sortKey: SortColumn = isSortColumn(sort) ? sort : "nome";
  const ascending = dir !== "desc";

  // nullsFirst: false garante que EPIs sem "tipo" preenchido sempre vão pro
  // final da lista, independente da direção — mesmo raciocínio usado pra
  // "última entrega" em colaboradores.
  return request.order(SORT_DB_COLUMN[sortKey], {
    ascending,
    nullsFirst: false,
  });
}

function mapEpi(e: {
  id: string;
  nome: string;
  tipo: string | null;
  ca: string | null;
  exige_ca: boolean;
  ca_validade: string | null;
  vida_util_dias: number | null;
  fornecedor: string | null;
  custo_medio_atual: number;
  ativo: boolean;
}): Epi {
  return {
    id: e.id,
    nome: e.nome,
    tipo: e.tipo,
    ca: e.ca,
    exigeCa: e.exige_ca,
    caValidade: e.ca_validade,
    vidaUtilDias: e.vida_util_dias,
    fornecedor: e.fornecedor,
    custoMedioAtual: e.custo_medio_atual,
    ativo: e.ativo,
  };
}

/**
 * Lista paginada do catálogo de EPIs, com busca por nome, filtro por tipo e
 * status, e ordenação por coluna. Diferente de colaboradores, aqui não
 * existe coluna derivada (como "última entrega") — todas as colunas
 * ordenáveis são colunas reais da tabela — então a ordenação e a paginação
 * acontecem direto no banco em vez de em memória.
 */
export async function listEpis({
  query,
  tipo,
  status,
  sort,
  dir,
  page = 1,
}: ListEpisOptions = {}): Promise<{ epis: Epi[]; total: number }> {
  const supabase = await createClient();

  const currentPage = page > 0 ? page : 1;
  const from = (currentPage - 1) * EPIS_PAGE_SIZE;
  const to = from + EPIS_PAGE_SIZE - 1;

  const { data, error, count } = await buildEpisQuery(supabase, {
    query,
    tipo,
    status,
    sort,
    dir,
    count: "exact",
  }).range(from, to);

  if (error || !data) {
    console.error("listEpis:", error?.message);
    return { epis: [], total: 0 };
  }

  return {
    epis: data.map(mapEpi),
    total: count ?? data.length,
  };
}

export type ListEpisExportOptions = {
  query?: string;
  tipo?: string;
  status?: string;
  sort?: string;
  dir?: string;
};

/**
 * Mesma busca, os mesmos filtros e a mesma ordenação de listEpis, mas sem
 * paginação — usada pela exportação em CSV, que precisa trazer todos os
 * EPIs que batem com o filtro atual da tela, não só os 20 da página visível.
 */
export async function listEpisParaExportar({
  query,
  tipo,
  status,
  sort,
  dir,
}: ListEpisExportOptions = {}): Promise<Epi[]> {
  const supabase = await createClient();

  const { data, error } = await buildEpisQuery(supabase, {
    query,
    tipo,
    status,
    sort,
    dir,
  });

  if (error || !data) {
    console.error("listEpisParaExportar:", error?.message);
    return [];
  }

  return data.map(mapEpi);
}
