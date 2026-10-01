import { createAdminClient } from "@/lib/supabase/admin";
import { getResumoPagamentos } from "./pagamentos";
import { contarEmpresasNoLimite } from "./empresas";
import { descreverLogAuditoria } from "./log-auditoria";

type AdminClient = ReturnType<typeof createAdminClient>;

function startOfMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
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
  const mes = startOfMonth(new Date());

  const [
    empresasAtivas,
    empresasInativas,
    usuarios,
    empresasNovas,
    resumoPagamentos,
    empresasNoLimiteColaboradores,
    atividadeRecente,
  ] = await Promise.all([
    admin.from("empresas").select("id", { count: "exact", head: true }).eq("ativo", true),
    admin.from("empresas").select("id", { count: "exact", head: true }).eq("ativo", false),
    admin.from("usuarios").select("id", { count: "exact", head: true }).eq("ativo", true),
    admin.from("empresas").select("id", { count: "exact", head: true }).gte("criado_em", mes),
    getResumoPagamentos(admin),
    contarEmpresasNoLimite(),
    getAtividadeRecente(admin),
  ]);

  return {
    totalEmpresasAtivas: empresasAtivas.count ?? 0,
    totalEmpresasInativas: empresasInativas.count ?? 0,
    totalUsuarios: usuarios.count ?? 0,
    empresasNovasNoMes: empresasNovas.count ?? 0,
    pagamentosAtrasados: resumoPagamentos.atrasados,
    pagamentosAVencer: resumoPagamentos.aVencer,
    empresasNoLimiteColaboradores,
    atividadeRecente,
  };
}
