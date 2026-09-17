import { createClient } from "@/lib/supabase/server";

/**
 * Usuário logado + empresa. Usado nos Server Components das rotas
 * protegidas para saudação e para qualquer filtro extra no cliente
 * (o isolamento real de dados é garantido pelo RLS no banco).
 */
export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, nome, papel, empresa_id, empresas ( nome )")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    nome: perfil?.nome ?? user.email ?? "Usuário",
    papel: perfil?.papel ?? "leitura",
    empresaId: perfil?.empresa_id ?? null,
    empresaNome:
      (perfil?.empresas as unknown as { nome: string } | null)?.nome ?? null,
  };
}
