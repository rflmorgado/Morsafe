import { createClient } from "@/lib/supabase/server";

export type EmpresaAtual = {
  id: string;
  nome: string;
  cnpj: string | null;
  logoUrl: string | null;
};

/**
 * Dados da empresa do usuário logado, incluindo o logo (PNG em data URL,
 * ver logo-empresa-form.tsx). Separado de getCurrentUser() de propósito: o
 * logo pode ter dezenas de KB em texto, e getCurrentUser() é chamado em
 * praticamente toda página protegida — colocar o logo lá bagunçaria o
 * carregamento de todas as telas por causa de duas telas (/empresa e a
 * Ficha de EPI) que realmente precisam dele.
 */
export async function getEmpresaAtual(
  empresaId: string,
): Promise<EmpresaAtual | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nome, cnpj, logo_url")
    .eq("id", empresaId)
    .maybeSingle();

  if (error || !data) {
    console.error("getEmpresaAtual:", error?.message);
    return null;
  }

  return {
    id: data.id,
    nome: data.nome,
    cnpj: data.cnpj,
    logoUrl: data.logo_url,
  };
}

/**
 * Só o logo (PNG em data URL), nada mais — usado pelo AppLayout pra mostrar
 * o logo na barra lateral, visível em toda página protegida (ver
 * app-shell.tsx, pedido do Rafael, 05/10/2026). Separado de getEmpresaAtual
 * de propósito: aquela função já existia pra alimentar só duas telas
 * (/empresa e a Ficha de EPI) e também traz nome/cnpj, que a barra lateral
 * não precisa (o nome já vem de getCurrentUser(), sem o peso do logo
 * embutido — ver comentário em getEmpresaAtual). Uma função dedicada, com um
 * único `select` enxuto, deixa claro que isso roda em toda página sem
 * arrastar nenhum campo a mais pra esse caminho quente.
 */
export async function getEmpresaLogoUrl(
  empresaId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("logo_url")
    .eq("id", empresaId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getEmpresaLogoUrl:", error.message);
    return null;
  }

  return data.logo_url;
}
