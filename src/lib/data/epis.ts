import { createClient } from "@/lib/supabase/server";

export const EPIS_PAGE_SIZE = 20;

// Lista de categorias fixas mora em epi-tipos.ts (sem depender do cliente
// Supabase de servidor) para poder ser importada por componentes cliente.
// Reexportada aqui só por conveniência de quem já importa deste arquivo.
export { TIPOS_EPI } from "./epi-tipos";

export type ListEpisOptions = {
  query?: string;
  tipo?: string;
  status?: string;
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

/**
 * Lista paginada do catálogo de EPIs, com busca por nome e filtro por tipo e
 * status. Diferente de colaboradores, aqui não existe coluna derivada (como
 * "última entrega"), então a ordenação e a paginação acontecem direto no
 * banco em vez de em memória.
 */
export async function listEpis({
  query,
  tipo,
  status,
  page = 1,
}: ListEpisOptions = {}): Promise<{ epis: Epi[]; total: number }> {
  const supabase = await createClient();

  const currentPage = page > 0 ? page : 1;
  const from = (currentPage - 1) * EPIS_PAGE_SIZE;
  const to = from + EPIS_PAGE_SIZE - 1;

  let request = supabase
    .from("epis")
    .select(
      "id, nome, tipo, ca, exige_ca, ca_validade, vida_util_dias, fornecedor, custo_medio_atual, ativo",
      { count: "exact" },
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

  const { data, error, count } = await request
    .order("nome", { ascending: true })
    .range(from, to);

  if (error || !data) {
    console.error("listEpis:", error?.message);
    return { epis: [], total: 0 };
  }

  return {
    epis: data.map((e) => ({
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
    })),
    total: count ?? data.length,
  };
}
