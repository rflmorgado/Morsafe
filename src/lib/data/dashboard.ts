import { createClient } from "@/lib/supabase/server";

function startOfMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

const DASHBOARD_VAZIO = {
  entregasMes: 0,
  variacaoEntregas: null as number | null,
  gastoMesTotal: 0,
  topSetor: null as { nome: string; pct: number } | null,
  estoqueBaixo: [] as {
    epi_id: string;
    nome: string;
    saldo_atual: number;
    limite_alerta: number;
  }[],
  estoqueBaixoTotal: 0,
  caVencendo: [] as {
    epi_id: string;
    nome: string;
    ca: string | null;
    ca_validade: string | null;
  }[],
  caVencendoTotal: 0,
};

/**
 * Números do dashboard operacional — sempre da empresa de quem está logado.
 * `empresaId` vem de getCurrentUser() (user.empresaId). Antes desta correção
 * nenhuma das 5 consultas filtrava por empresa_id — dependia inteiramente do
 * RLS pra isolar uma empresa cliente da outra, na contramão do padrão de
 * "defesa em profundidade" já usado no resto do projeto (conferir a empresa
 * explicitamente no código, além do RLS). Na prática isso vazava dado
 * operacional de empresa cliente pro super_admin (dono do MorSafe, que não
 * pertence a nenhuma empresa — `empresaId: null` — e deveria ver o dashboard
 * sempre zerado, já que essa conta só existe pra cadastrar empresas novas em
 * /setup-empresa).
 */
export async function getDashboardData(empresaId: string | null) {
  if (!empresaId) {
    return DASHBOARD_VAZIO;
  }

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
        .eq("empresa_id", empresaId)
        .gte("data", mes),
      supabase
        .from("entregas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .gte("data", mesAnterior)
        .lt("data", mes),
      supabase
        .from("vw_consumo_mensal")
        .select("setor, gasto_total")
        .eq("empresa_id", empresaId)
        .eq("mes", mes),
      supabase
        .from("vw_estoque_baixo")
        // count: "exact" aqui é o que faz `.count` abaixo refletir o TOTAL de
        // linhas que batem com o filtro da view, não as 6 retornadas pelo
        // .limit() — sem isso, estoqueBaixoTotal caía pro fallback
        // `.data?.length`, travado em 6 mesmo quando existiam 23 itens em
        // risco. Card de risco de conformidade mentindo "tudo certo" quando
        // não estava.
        .select("epi_id, nome, saldo_atual, limite_alerta", { count: "exact" })
        .eq("empresa_id", empresaId)
        .order("saldo_atual", { ascending: true })
        .limit(6),
      supabase
        .from("vw_ca_vencendo")
        .select("epi_id, nome, ca, ca_validade", { count: "exact" })
        .eq("empresa_id", empresaId)
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
