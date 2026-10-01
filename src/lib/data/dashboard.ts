import { createClient } from "@/lib/supabase/server";
import { getEstoqueStatusCounts, type EstoqueStatusCounts } from "./estoque";
import { getNr06StatusCounts, type Nr06StatusCounts } from "./colaboradores";

function startOfMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

// "2026-03" — chave de agrupamento por mês, usada tanto pra combinar a data
// de uma entrega (string "aaaa-mm-dd") quanto pra gerar os 6 meses do
// gráfico de tendência abaixo.
function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// "Mar" — rótulo curto em português pro eixo do gráfico de tendência.
// toLocaleDateString devolve "mar." (com ponto); removido porque, num rótulo
// de eixo tão curto, o ponto só polui.
function monthLabel(date: Date) {
  const bruto = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return bruto.charAt(0).toUpperCase() + bruto.slice(1);
}

const DASHBOARD_VAZIO = {
  entregasMes: 0,
  variacaoEntregas: null as number | null,
  entregasPorMes: [] as { label: string; total: number }[],
  gastoMesTotal: 0,
  topSetor: null as { nome: string; pct: number } | null,
  gastoPorSetor: [] as { nome: string; valor: number; pct: number }[],
  estoqueBaixo: [] as {
    epi_id: string;
    nome: string;
    saldo_atual: number;
    limite_alerta: number;
  }[],
  estoqueBaixoTotal: 0,
  estoqueStatus: { critico: 0, alerta: 0, ok: 0 } as EstoqueStatusCounts,
  caVencendo: [] as {
    epi_id: string;
    nome: string;
    ca: string | null;
    ca_validade: string | null;
  }[],
  caVencendoTotal: 0,
  nr06: { emDia: 0, pendente: 0 } as Nr06StatusCounts,
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
  // Início do mês de 5 meses atrás — com o mês corrente, fecha a janela de 6
  // meses do gráfico de tendência "Entregas nos últimos 6 meses".
  const seisMesesAtras = startOfMonth(
    new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1),
  );

  const [
    entregasMes,
    entregasMesAnterior,
    entregasHistorico,
    consumoMensal,
    estoqueBaixo,
    caVencendo,
    estoqueStatus,
    nr06,
  ] = await Promise.all([
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
    // Só a data de cada entrega dos últimos 6 meses — agrupada por mês em
    // memória logo abaixo (monthKey) — não precisa de nenhuma outra coluna
    // pro gráfico de tendência, só a contagem por mês.
    supabase
      .from("entregas")
      .select("data")
      .eq("empresa_id", empresaId)
      .gte("data", seisMesesAtras),
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
    getEstoqueStatusCounts(empresaId),
    getNr06StatusCounts(empresaId),
  ]);

  const consumoRows = consumoMensal.data ?? [];
  const gastoMesTotal = consumoRows.reduce(
    (acc, r) => acc + Number(r.gasto_total ?? 0),
    0,
  );

  const gastoPorSetorMap = new Map<string, number>();
  for (const row of consumoRows) {
    gastoPorSetorMap.set(
      row.setor,
      (gastoPorSetorMap.get(row.setor) ?? 0) + Number(row.gasto_total ?? 0),
    );
  }
  let topSetor: { nome: string; pct: number } | null = null;
  for (const [nome, gasto] of gastoPorSetorMap) {
    const pct = gastoMesTotal > 0 ? Math.round((gasto / gastoMesTotal) * 100) : 0;
    if (!topSetor || pct > topSetor.pct) topSetor = { nome, pct };
  }

  // Top 5 setores por gasto, maior primeiro, pro donut "Gasto por setor" —
  // o resto (se houver) soma numa fatia "Outros", em vez de um gráfico com
  // fatia demais pra ler (mesma regra de "dobrar em Outros" da skill de
  // dataviz usada nesses gráficos: cor categórica nunca cresce sem limite).
  const TOP_SETORES_CHART = 5;
  const setoresOrdenados = Array.from(gastoPorSetorMap.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);

  const gastoPorSetor = setoresOrdenados
    .slice(0, TOP_SETORES_CHART)
    .map((s) => ({
      nome: s.nome,
      valor: s.valor,
      pct: gastoMesTotal > 0 ? Math.round((s.valor / gastoMesTotal) * 100) : 0,
    }));
  if (setoresOrdenados.length > TOP_SETORES_CHART) {
    const valorOutros = setoresOrdenados
      .slice(TOP_SETORES_CHART)
      .reduce((acc, s) => acc + s.valor, 0);
    gastoPorSetor.push({
      nome: "Outros",
      valor: valorOutros,
      pct: gastoMesTotal > 0 ? Math.round((valorOutros / gastoMesTotal) * 100) : 0,
    });
  }

  // Agrupa as entregas dos últimos 6 meses por mês ("aaaa-mm") e depois
  // monta os 6 pontos do gráfico (mais antigo primeiro), preenchendo com 0
  // qualquer mês sem nenhuma entrega — sem isso, um mês parado simplesmente
  // não apareceria no gráfico, em vez de aparecer como uma barra zerada.
  const contagemPorMes = new Map<string, number>();
  for (const row of entregasHistorico.data ?? []) {
    const chave = String(row.data).slice(0, 7);
    contagemPorMes.set(chave, (contagemPorMes.get(chave) ?? 0) + 1);
  }
  const entregasPorMes = Array.from({ length: 6 }, (_, i) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
    return {
      label: monthLabel(data),
      total: contagemPorMes.get(monthKey(data)) ?? 0,
    };
  });

  const anterior = entregasMesAnterior.count ?? 0;
  const atual = entregasMes.count ?? 0;
  const variacaoEntregas =
    anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : null;

  return {
    entregasMes: atual,
    variacaoEntregas,
    entregasPorMes,
    gastoMesTotal,
    topSetor,
    gastoPorSetor,
    estoqueBaixo: estoqueBaixo.data ?? [],
    estoqueBaixoTotal: estoqueBaixo.count ?? estoqueBaixo.data?.length ?? 0,
    estoqueStatus,
    caVencendo: caVencendo.data ?? [],
    caVencendoTotal: caVencendo.count ?? caVencendo.data?.length ?? 0,
    nr06,
  };
}
