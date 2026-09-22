import { createAdminClient } from "@/lib/supabase/admin";

export type PapelUsuarioEmpresa = "admin" | "encarregado" | "leitura";

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuarioEmpresa;
  ativo: boolean;
};

/**
 * Lista os usuários de UMA empresa (pra tela "Usuários", visível só pro
 * admin da própria empresa). Usa o cliente com service role porque ainda
 * não existe uma política de RLS que deixe um admin ler todas as linhas da
 * própria empresa na tabela `usuarios` (hoje cada usuário só lê a própria
 * linha) — por isso o filtro por `empresaId` abaixo é a única barreira
 * real. Quem chama esta função precisa ter confirmado ANTES que quem está
 * pedindo é de fato admin daquela empresa (ver checagem em
 * src/app/(app)/usuarios/page.tsx e em actions.ts).
 */
export async function listUsuariosDaEmpresa(
  empresaId: string,
): Promise<Usuario[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("usuarios")
    .select("id, nome, papel, ativo")
    .eq("empresa_id", empresaId)
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("listUsuariosDaEmpresa:", error?.message);
    return [];
  }

  // E-mail não fica na tabela `usuarios` (só existe em auth.users) — busca
  // à parte pela Admin API e junta pelo id. Empresas pequenas (poucos
  // usuários cada), então N chamadas aqui é aceitável.
  const comEmail = await Promise.all(
    data.map(async (u) => {
      const { data: authUser } = await admin.auth.admin.getUserById(u.id);
      return {
        id: u.id,
        nome: u.nome,
        email: authUser?.user?.email ?? "—",
        papel: u.papel as PapelUsuarioEmpresa,
        ativo: u.ativo,
      };
    }),
  );

  return comEmail;
}
