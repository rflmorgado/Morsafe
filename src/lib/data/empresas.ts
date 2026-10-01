import { createAdminClient } from "@/lib/supabase/admin";

export type EmpresaResumo = {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  criadoEm: string;
  totalColaboradores: number;
  totalEpis: number;
  totalUsuarios: number;
};

type AdminClient = ReturnType<typeof createAdminClient>;
type EmpresaRow = { id: string; nome: string; cnpj: string | null; ativo: boolean; criado_em: string };

async function comResumo(
  admin: AdminClient,
  e: EmpresaRow,
): Promise<EmpresaResumo> {
  const [colaboradores, epis, usuarios] = await Promise.all([
    admin
      .from("colaboradores")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", e.id)
      .eq("status", "ativo"),
    admin
      .from("epis")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", e.id)
      .eq("ativo", true),
    admin
      .from("usuarios")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", e.id)
      .eq("ativo", true),
  ]);

  return {
    id: e.id,
    nome: e.nome,
    cnpj: e.cnpj,
    ativo: e.ativo,
    criadoEm: e.criado_em,
    totalColaboradores: colaboradores.count ?? 0,
    totalEpis: epis.count ?? 0,
    totalUsuarios: usuarios.count ?? 0,
  };
}

/**
 * Todas as empresas clientes do MorSafe, com um resumo operacional de cada
 * uma — só para a tela de administração do super_admin (ver
 * app/(app)/empresas/page.tsx).
 *
 * Usa o cliente com service role (mesmo padrão de usuarios/actions.ts):
 * `empresas` não tem RLS (igual a `estoque` não teria sentido pra um
 * super_admin, que nunca pertence a uma `empresa_id` — auth_empresa_id()
 * retornaria null e qualquer policy baseada nela nunca bateria com nada).
 *
 * Uma consulta de contagem por tabela por empresa (em vez de um único
 * join agregado) — mais simples de manter e, com o número de empresas
 * clientes do MorSafe hoje (poucas dezenas, não milhares), o custo de rodar
 * em paralelo por empresa é desprezível perto da simplicidade.
 */
export async function listEmpresasComResumo(): Promise<EmpresaResumo[]> {
  const admin = createAdminClient();

  const { data: empresas, error } = await admin
    .from("empresas")
    .select("id, nome, cnpj, ativo, criado_em")
    .order("criado_em", { ascending: false });

  if (error || !empresas) {
    console.error("listEmpresasComResumo:", error?.message);
    return [];
  }

  return Promise.all(empresas.map((e) => comResumo(admin, e)));
}

/**
 * Lista enxuta (id + nome) de todas as empresas, só pra alimentar o
 * seletor "Empresa" do formulário de novo pagamento (ver
 * app/(app)/pagamentos/novo-pagamento-button.tsx) — sem as contagens de
 * comResumo(), que seriam um desperdício de consultas só pra preencher um
 * <select>.
 */
export async function listEmpresasParaSelect(): Promise<
  { id: string; nome: string }[]
> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("empresas")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("listEmpresasParaSelect:", error?.message);
    return [];
  }

  return data;
}

/**
 * Mesmo resumo de listEmpresasComResumo, mas só de uma empresa — pra tela
 * de detalhe (app/(app)/empresas/[id]/page.tsx). Retorna null se o id não
 * existir.
 */
export async function getEmpresaComResumo(
  empresaId: string,
): Promise<EmpresaResumo | null> {
  const admin = createAdminClient();

  const { data: empresa, error } = await admin
    .from("empresas")
    .select("id, nome, cnpj, ativo, criado_em")
    .eq("id", empresaId)
    .maybeSingle();

  if (error || !empresa) {
    if (error) console.error("getEmpresaComResumo:", error.message);
    return null;
  }

  return comResumo(admin, empresa);
}
