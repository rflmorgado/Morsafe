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
