import { createClient } from "@/lib/supabase/server";

export const COLABORADORES_PAGE_SIZE = 20;

export type ListColaboradoresOptions = {
  query?: string;
  setorId?: string;
  page?: number;
};

/**
 * Lista paginada de colaboradores (20 por página por padrão), com busca por
 * nome e filtro por setor opcionais. Evita renderizar centenas de linhas de
 * uma vez — importante já que uma empresa pode ter 100+ colaboradores e
 * isso ficava enorme, principalmente no celular.
 */
export async function listColaboradores({
  query,
  setorId,
  page = 1,
}: ListColaboradoresOptions = {}) {
  const supabase = await createClient();

  let request = supabase
    .from("colaboradores")
    .select("id, nome, status, setores ( nome ), cargos ( nome )", {
      count: "exact",
    })
    .order("nome", { ascending: true });

  if (query && query.trim()) {
    request = request.ilike("nome", `%${query.trim()}%`);
  }
  if (setorId) {
    request = request.eq("setor_id", setorId);
  }

  const currentPage = page > 0 ? page : 1;
  const from = (currentPage - 1) * COLABORADORES_PAGE_SIZE;
  const to = from + COLABORADORES_PAGE_SIZE - 1;

  const { data, error, count } = await request.range(from, to);

  if (error || !data) {
    console.error("listColaboradores:", error?.message);
    return { colaboradores: [], total: 0 };
  }

  const ids = data.map((c) => c.id);
  const { data: entregas } = ids.length
    ? await supabase
        .from("entregas")
        .select("colaborador_id, data")
        .in("colaborador_id", ids)
        .order("data", { ascending: false })
    : { data: [] as { colaborador_id: string; data: string }[] };

  const ultimaEntrega = new Map<string, string>();
  for (const e of entregas ?? []) {
    if (!ultimaEntrega.has(e.colaborador_id)) {
      ultimaEntrega.set(e.colaborador_id, e.data);
    }
  }

  return {
    colaboradores: data.map((c) => ({
      id: c.id,
      nome: c.nome,
      status: c.status,
      setor: (c.setores as unknown as { nome: string } | null)?.nome ?? "—",
      cargo: (c.cargos as unknown as { nome: string } | null)?.nome ?? "—",
      ultimaEntrega: ultimaEntrega.get(c.id) ?? null,
    })),
    total: count ?? data.length,
  };
}

export async function getColaboradorDetalhe(id: string) {
  const supabase = await createClient();

  const { data: colaborador, error } = await supabase
    .from("colaboradores")
    .select(
      "id, nome, status, criado_em, setores ( nome ), cargos ( nome )",
    )
    .eq("id", id)
    .single();

  if (error || !colaborador) return null;

  const [entregas, devolucoes, recusas] = await Promise.all([
    supabase
      .from("entregas")
      .select("id, data, hora, motivo, epis ( nome, ca )")
      .eq("colaborador_id", id)
      .order("data", { ascending: false }),
    supabase
      .from("devolucoes")
      .select("id, data, motivo, destino, devolvido_fisicamente, epis ( nome, ca )")
      .eq("colaborador_id", id)
      .order("data", { ascending: false }),
    supabase
      .from("recusas")
      .select("id, data, hora, observacoes, epis ( nome, ca )")
      .eq("colaborador_id", id)
      .order("data", { ascending: false }),
  ]);

  type Evento = {
    id: string;
    tipo: "entrega" | "devolucao" | "recusa";
    data: string;
    epi: string;
    ca: string | null;
    detalhe: string;
  };

  const eventos: Evento[] = [
    ...(entregas.data ?? []).map((e) => ({
      id: `entrega-${e.id}`,
      tipo: "entrega" as const,
      data: e.data,
      epi: (e.epis as unknown as { nome: string; ca: string | null } | null)?.nome ?? "—",
      ca: (e.epis as unknown as { nome: string; ca: string | null } | null)?.ca ?? null,
      detalhe: e.motivo.replaceAll("_", " "),
    })),
    ...(devolucoes.data ?? []).map((d) => ({
      id: `devolucao-${d.id}`,
      tipo: "devolucao" as const,
      data: d.data,
      epi: (d.epis as unknown as { nome: string; ca: string | null } | null)?.nome ?? "—",
      ca: (d.epis as unknown as { nome: string; ca: string | null } | null)?.ca ?? null,
      detalhe: `${d.motivo.replaceAll("_", " ")}${
        d.devolvido_fisicamente ? "" : " · não devolvido fisicamente"
      }`,
    })),
    ...(recusas.data ?? []).map((r) => ({
      id: `recusa-${r.id}`,
      tipo: "recusa" as const,
      data: r.data,
      epi: (r.epis as unknown as { nome: string; ca: string | null } | null)?.nome ?? "—",
      ca: (r.epis as unknown as { nome: string; ca: string | null } | null)?.ca ?? null,
      detalhe: r.observacoes ?? "Recusa registrada",
    })),
  ].sort((a, b) => (a.data < b.data ? 1 : -1));

  return {
    id: colaborador.id,
    nome: colaborador.nome,
    status: colaborador.status,
    setor: (colaborador.setores as unknown as { nome: string } | null)?.nome ?? "—",
    cargo: (colaborador.cargos as unknown as { nome: string } | null)?.nome ?? "—",
    criadoEm: colaborador.criado_em,
    eventos,
  };
}
