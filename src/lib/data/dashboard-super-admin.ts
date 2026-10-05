import { createAdminClient } from "@/lib/supabase/admin";
import { getResumoPagamentos } from "./pagamentos";
import { contarEmpresasNoLimite } from "./empresas";
import { descreverLogAuditoria } from "./log-auditoria";

type AdminClient = ReturnType<typeof createAdminClient>;

function startOfMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

// "2026-03" — chave de agrupamento por mês, mesma técnica de
// getDashboardData (dashboard.ts) pro gráfico "Entregas nos últimos 6
// meses": agrupa em memória em vez de agregar no banco, já que são só 6
// meses e poucas dezenas de empresas.
function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// "Mar" — rótulo curto em português pro eixo do gráfico de tendência (ver
// mesmo helper em dashboard.ts). toLocaleDateString devolve "mar." (com
// ponto); removido porque, num rótulo de eixo tão curto, o ponto só polui.
function monthLabel(date: Date) {
  const bruto = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return bruto.charAt(0).toUpperCase() + bruto.slice(1);
}

export type AtividadeRecente = {
  id: string;
  descricao: string;
  criadoEm: string;
};

/**
 * Últimas ações administrativas (empresa criada/desativada/reativada,
 * dados de teste resetados, pagamento registrado/recebido) — alimenta o
 * card "Atividade recente" do Dashboard do super_admin, puxando do mesmo
 * log_auditoria já usado na tela de Usuários, só que aqui sem filtrar por
 * um usuário específico.
 */
async function getAtividadeRecente(
  admin: AdminClient,
): Promise<AtividadeRecente[]> {
  const { data, error } = await admin
    .from("log_auditoria")
    .select("id, tabela_referencia, registro_id, acao, detalhes, criado_em")
    .in("tabela_referencia", ["empresas", "pagamentos_empresa"])
    .order("criado_em", { ascending: false })
    .limit(8);

  if (error || !data) {
    console.error("getAtividadeRecente:", error?.message);
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    descricao: descreverLogAuditoria({
      id: item.id,
      tabela: item.tabela_referencia,
      registroId: item.registro_id,
      acao: item.acao,
      detalhes: item.detalhes as Record<string, unknown> | null,
      criadoEm: item.criado_em,
    }),
    criadoEm: item.criado_em,
  }));
}

export type DashboardSuperAdminData = {
  totalEmpresasAtivas: number;
  totalEmpresasInativas: number;
  totalUsuarios: number;
  empresasNovasNoMes: number;
  empresasNovasPorMes: { label: string; total: number }[];
  pagamentosAtrasados: number;
  pagamentosAVencer: number;
  empresasNoLimiteColaboradores: number;
  atividadeRecente: AtividadeRecente[];
};

/**
 * Números do Dashboard do super_admin — visão de negócio (quantas empresas,
 * quantos usuários, quem está devendo), bem diferente do Dashboard
 * operacional de uma empresa cliente (getDashboardData, em dashboard.ts),
 * que não faz sentido pra quem não pertence a nenhuma empresa.
 */
export async function getDashboardSuperAdmin(): Promise<DashboardSuperAdminData> {
  const admin = createAdminClient();
  const hoje = new Date();
  const mes = startOfMonth(hoje);
  // Início do mês de 5 meses atrás — com o mês corrente, fecha a janela de 6
  // meses do gráfico "Novas empresas nos últimos 6 meses" (mesma janela de
  // getDashboardData, em dashboard.ts).
  const seisMesesAtras = startOfMonth(
    new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1),
  );

  const [
    empresasAtivas,
    empresasInativas,
    usuarios,
    empresasNovas,
    empresasHistorico,
    resumoPagamentos,
    empresasNoLimiteColaboradores,
    atividadeRecente,
  ] = await Promise.all([
    admin.from("empresas").select("id", { count: "exact", head: true }).eq("ativo", true),
    admin.from("empresas").select("id", { count: "exact", head: true }).eq("ativo", false),
    admin.from("usuarios").select("id", { count: "exact", head: true }).eq("ativo", true),
    admin.from("empresas").select("id", { count: "exact", head: true }).gte("criado_em", mes),
    // Só a data de criação das empresas dos últimos 6 meses — agrupada por
    // mês em memória logo abaixo (monthKey), igual ao gráfico de tendência
    // de getDashboardData.
    admin.from("empresas").select("criado_em").gte("criado_em", seisMesesAtras),
    getResumoPagamentos(admin),
    contarEmpresasNoLimite(),
    getAtividadeRecente(admin),
  ]);

  // Agrupa as empresas novas dos últimos 6 meses por mês ("aaaa-mm") e
  // depois monta os 6 pontos do gráfico (mais antigo primeiro), preenchendo
  // com 0 qualquer mês sem nenhuma empresa nova — sem isso, um mês parado
  // simplesmente não apareceria no gráfico, em vez de aparecer como uma
  // barra zerada (mesma lógica de entregasPorMes em dashboard.ts).
  const contagemPorMes = new Map<string, number>();
  for (const row of empresasHistorico.data ?? []) {
    const chave = String(row.criado_em).slice(0, 7);
    contagemPorMes.set(chave, (contagemPorMes.get(chave) ?? 0) + 1);
  }
  const empresasNovasPorMes = Array.from({ length: 6 }, (_, i) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
    return {
      label: monthLabel(data),
      total: contagemPorMes.get(monthKey(data)) ?? 0,
    };
  });

  return {
    totalEmpresasAtivas: empresasAtivas.count ?? 0,
    totalEmpresasInativas: empresasInativas.count ?? 0,
    totalUsuarios: usuarios.count ?? 0,
    empresasNovasNoMes: empresasNovas.count ?? 0,
    empresasNovasPorMes,
    pagamentosAtrasados: resumoPagamentos.atrasados,
    pagamentosAVencer: resumoPagamentos.aVencer,
    empresasNoLimiteColaboradores,
    atividadeRecente,
  };
}
