import { createClient } from "@/lib/supabase/server";

function startOfMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function getDashboardData() {
  const supabase = await createClient();
  const hoje = new Date();
  const mes = startOfMonth(hoje);
  const mesAnterior = startOfMonth(
    new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
  );

  const [entregasMes, entregasMesAnterior, consumoMensal, estoqueBaixo, caVencendo] =
    await Promise.all([
      supabase
        .from("entregas")
        .select("id", { count: "exact", head: true })
        .gte("data", mes),
      supabase
        .from("entregas")
        .select("id", { count: "exact", head: true })
        .gte("data", mesAnterior)
        .lt("data", mes),
      supabase
        .from("vw_consumo_mensal")
        .select("setor, gasto_total")
        .eq("mes", mes),
      supabase
        .from("vw_estoque_baixo")
        .select("epi_id, nome, saldo_atual, limite_alerta")
        .order("saldo_atual", { ascending: true })
        .limit(6),
      supabase
        .from("vw_ca_vencendo")
        .select("epi_id, nome, ca, ca_validade")
        .order("ca_validade", { ascending: true })
        .limit(6),
    ]);

  const consumoRows = consumoMensal.data ?? [];
  const gastoMesTotal = consumoRows.reduce(
    (acc, r) => acc + Number(r.gasto_total ?? 0),
    0,
  );

  const gastoPorSetor = new Map<string, number>();
  for (const row of consumoRows) {
    gastoPorSetor.set(
      row.setor,
      (gastoPorSetor.get(row.setor) ?? 0) + Number(row.gasto_total ?? 0),
    );
  }
  let topSetor: { nome: string; pct: number } | null = null;
  for (const [nome, gasto] of gastoPorSetor) {
    const pct = gastoMesTotal > 0 ? Math.round((gasto / gastoMesTotal) * 100) : 0;
    if (!topSetor || pct > topSetor.pct) topSetor = { nome, pct };
  }

  const anterior = entregasMesAnterior.count ?? 0;
  const atual = entregasMes.count ?? 0;
  const variacaoEntregas =
    anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : null;

  return {
    entregasMes: atual,
    variacaoEntregas,
    gastoMesTotal,
    topSetor,
    estoqueBaixo: estoqueBaixo.data ?? [],
    estoqueBaixoTotal: estoqueBaixo.count ?? estoqueBaixo.data?.length ?? 0,
    caVencendo: caVencendo.data ?? [],
    caVencendoTotal: caVencendo.count ?? caVencendo.data?.length ?? 0,
  };
}
