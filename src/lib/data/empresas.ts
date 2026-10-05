import { createAdminClient } from "@/lib/supabase/admin";

export type EmpresaResumo = {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  criadoEm: string;
  // PNG em data URL (ver logo-empresa-form.tsx) ou null — direto no mesmo
  // select de empresas (sem a separação enxuta de getEmpresaLogoUrl, em
  // empresa.ts): esta lista já é exclusiva do super_admin, com poucas
  // dezenas de linhas (não toda página protegida como a barra lateral), o
  // peso extra do logo em cada linha é desprezível aqui.
  logoUrl: string | null;
  totalColaboradores: number;
  totalEpis: number;
  totalUsuarios: number;
  // Colaboradores ativos cobertos pelo plano contratado — null = sem
  // limite definido ainda (nenhum alerta é mostrado). Ver
  // getLimiteColaboradores abaixo pro motivo de ser buscado à parte.
  limiteColaboradores: number | null;
};

type AdminClient = ReturnType<typeof createAdminClient>;
type EmpresaRow = {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  criado_em: string;
  logo_url: string | null;
};

/**
 * Busca limite_colaboradores EM UMA CONSULTA SEPARADA do resto do resumo —
 * de propósito. Essa coluna é nova (ver
 * morsafe-add-limite-colaboradores.sql) e ainda não existe em produção
 * enquanto o acesso ao Supabase continuar bloqueado; se ela estivesse no
 * mesmo .select() que busca id/nome/cnpj/ativo/criado_em, UM erro de
 * "coluna não existe" faria a empresa inteira sumir da lista (comResumo/
 * listEmpresasComResumo não teriam como separar "empresa não encontrada"
 * de "essa coluna nova ainda não existe"). Isolada aqui, a mesma falha vira
 * só "sem limite definido" (null), sem afetar nada mais da tela.
 */
async function getLimiteColaboradores(
  admin: AdminClient,
  empresaId: string,
): Promise<number | null> {
  try {
    const { data, error } = await admin
      .from("empresas")
      .select("limite_colaboradores")
      .eq("id", empresaId)
      .maybeSingle();
    if (error || !data) return null;
    return data.limite_colaboradores;
  } catch {
    return null;
  }
}

async function comResumo(
  admin: AdminClient,
  e: EmpresaRow,
): Promise<EmpresaResumo> {
  const [colaboradores, epis, usuarios, limiteColaboradores] = await Promise.all([
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
    getLimiteColaboradores(admin, e.id),
  ]);

  return {
    id: e.id,
    nome: e.nome,
    cnpj: e.cnpj,
    ativo: e.ativo,
    criadoEm: e.criado_em,
    logoUrl: e.logo_url,
    totalColaboradores: colaboradores.count ?? 0,
    totalEpis: epis.count ?? 0,
    totalUsuarios: usuarios.count ?? 0,
    limiteColaboradores,
  };
}

/**
 * Selo visual de alerta de limite de colaboradores — null quando não há
 * limite definido ou quando a empresa está bem longe dele (sem poluir a
 * tela com um selo pra toda empresa). Usado tanto na lista (/empresas)
 * quanto no detalhe (/empresas/[id]).
 */
export function statusLimiteColaboradores(
  totalColaboradores: number,
  limiteColaboradores: number | null,
): { texto: string; classe: string } | null {
  if (limiteColaboradores === null) return null;
  if (totalColaboradores >= limiteColaboradores) {
    return { texto: "No limite do plano", classe: "bg-danger-bg text-danger-text" };
  }
  if (totalColaboradores >= limiteColaboradores * 0.9) {
    return { texto: "Perto do limite", classe: "bg-warning-bg text-warning-text" };
  }
  return null;
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
    .select("id, nome, cnpj, ativo, criado_em, logo_url")
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
    .select("id, nome, cnpj, ativo, criado_em, logo_url")
    .eq("id", empresaId)
    .maybeSingle();

  if (error || !empresa) {
    if (error) console.error("getEmpresaComResumo:", error.message);
    return null;
  }

  return comResumo(admin, empresa);
}

/**
 * Quantas empresas clientes já alcançaram ou passaram o limite de
 * colaboradores ativos do plano contratado — alimenta o KPI "Empresas no
 * limite" do Dashboard do super_admin (ver
 * lib/data/dashboard-super-admin.ts). Empresa sem limite definido
 * (limiteColaboradores null) nunca entra nessa contagem.
 *
 * Reaproveita listEmpresasComResumo() em vez de uma consulta própria —
 * mesma lista que já alimenta a tela /empresas, e o volume de empresas
 * clientes do MorSafe hoje (poucas dezenas) torna isso barato o bastante
 * pra não precisar de uma versão otimizada só pra essa contagem.
 */
export async function contarEmpresasNoLimite(): Promise<number> {
  const empresas = await listEmpresasComResumo();
  return empresas.filter(
    (e) =>
      e.limiteColaboradores !== null &&
      e.totalColaboradores >= e.limiteColaboradores,
  ).length;
}
