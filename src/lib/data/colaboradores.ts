import { createClient } from "@/lib/supabase/server";

export async function listColaboradores(query?: string) {
  const supabase = await createClient();

  let request = supabase
    .from("colaboradores")
    .select(
      "id, nome, status, setores ( nome ), cargos ( nome )",
    )
    .order("nome", { ascending: true });

  if (query && query.trim()) {
    request = request.ilike("nome", `%${query.trim()}%`);
  }

  const { data, error } = await request;

  if (error) {
    console.error("listColaboradores:", error.message);
    return [];
  }

  const { data: entregas } = await supabase
    .from("entregas")
    .select("colaborador_id, data")
    .order("data", { ascending: false });

  const ultimaEntrega = new Map<string, string>();
  for (const e of entregas ?? []) {
    if (!ultimaEntrega.has(e.colaborador_id)) {
      ultimaEntrega.set(e.colaborador_id, e.data);
    }
  }

  return data.map((c) => ({
    id: c.id,
    nome: c.nome,
    status: c.status,
    setor: (c.setores as unknown as { nome: string } | null)?.nome ?? "—",
    cargo: (c.cargos as unknown as { nome: string } | null)?.nome ?? "—",
    ultimaEntrega: ultimaEntrega.get(c.id) ?? null,
  }));
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
      .select("id, data, hora, motivo, epis ( nome )")
      .eq("colaborador_id", id)
      .order("data", { ascending: false }),
    supabase
      .from("devolucoes")
      .select("id, data, motivo, destino, devolvido_fisicamente, epis ( nome )")
      .eq("colaborador_id", id)
      .order("data", { ascending: false }),
    supabase
      .from("recusas")
      .select("id, data, hora, observacoes, epis ( nome )")
      .eq("colaborador_id", id)
      .order("data", { ascending: false }),
  ]);

  type Evento = {
    id: string;
    tipo: "entrega" | "devolucao" | "recusa";
    data: string;
    epi: string;
    detalhe: string;
  };

  const eventos: Evento[] = [
    ...(entregas.data ?? []).map((e) => ({
      id: `entrega-${e.id}`,
      tipo: "entrega" as const,
      data: e.data,
      epi: (e.epis as unknown as { nome: string } | null)?.nome ?? "—",
      detalhe: e.motivo.replaceAll("_", " "),
    })),
    ...(devolucoes.data ?? []).map((d) => ({
      id: `devolucao-${d.id}`,
      tipo: "devolucao" as const,
      data: d.data,
      epi: (d.epis as unknown as { nome: string } | null)?.nome ?? "—",
      detalhe: `${d.motivo.replaceAll("_", " ")}${
        d.devolvido_fisicamente ? "" : " · não devolvido fisicamente"
      }`,
    })),
    ...(recusas.data ?? []).map((r) => ({
      id: `recusa-${r.id}`,
      tipo: "recusa" as const,
      data: r.data,
      epi: (r.epis as unknown as { nome: string } | null)?.nome ?? "—",
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
