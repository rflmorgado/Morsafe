"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";

export type CriarEmpresaState = {
  error: string | null;
  success?: boolean;
};

/**
 * Cadastro de nova empresa cliente + seu primeiro usuário admin. Só pode
 * ser executado por um usuário com papel "super_admin" (dono do MorSafe) —
 * checado aqui no servidor, além de o item de menu só aparecer para esse
 * papel (ver NAV_ITEMS / app-shell.tsx).
 */
export async function criarEmpresa(
  _prev: CriarEmpresaState,
  formData: FormData,
): Promise<CriarEmpresaState> {
  const requester = await getCurrentUser();
  if (!requester || requester.papel !== "super_admin") {
    return { error: "Acesso restrito." };
  }

  const empresaNome = String(formData.get("empresaNome") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").trim();
  const endereco = String(formData.get("endereco") ?? "").trim();
  const adminNome = String(formData.get("adminNome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!empresaNome || !adminNome || !email || !senha) {
    return {
      error: "Preencha nome da empresa, nome do admin, e-mail e senha.",
    };
  }
  if (senha.length < 6) {
    return { error: "A senha do usuário admin deve ter ao menos 6 caracteres." };
  }

  const supabase = await createClient();

  // 1) Cria a empresa primeiro (tabela sem RLS, insert sempre permitido).
  const { data: empresa, error: empresaError } = await supabase
    .from("empresas")
    .insert({
      nome: empresaNome,
      cnpj: cnpj || null,
      endereco: endereco || null,
    })
    .select("id")
    .single();

  if (empresaError || !empresa) {
    console.error("criarEmpresa (insert empresa):", empresaError?.message);
    return {
      error: `Não foi possível criar a empresa. Detalhe: ${empresaError?.message ?? "erro desconhecido"}`,
    };
  }

  // 2) Cria o usuário no Supabase Auth. Isso substitui, nos cookies do
  // navegador atual, a sessão do super_admin pela do usuário recém-criado —
  // por isso, ao final, encerramos essa sessão nova (signOut) e o
  // super_admin precisará entrar de novo depois de usar esta tela.
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
    { email, password: senha },
  );

  if (signUpError || !signUpData.user) {
    console.error("criarEmpresa (signUp):", signUpError?.message);
    // Best-effort: remove a empresa órfã já que o usuário não foi criado.
    await supabase.from("empresas").delete().eq("id", empresa.id);
    return {
      error:
        signUpError?.message === "User already registered"
          ? "Já existe um usuário com esse e-mail."
          : `Não foi possível criar o usuário. Detalhe: ${signUpError?.message ?? "erro desconhecido"}`,
    };
  }

  if (!signUpData.session) {
    return {
      error:
        "O usuário foi criado, mas a confirmação de e-mail está ativa no Supabase (Authentication > Providers > Email > 'Confirm email'). Desative essa opção, apague o usuário incompleto em Authentication > Users e tente novamente.",
    };
  }

  // 3) Vincula o usuário à empresa como admin.
  const { error: usuarioError } = await supabase.from("usuarios").insert({
    id: signUpData.user.id,
    empresa_id: empresa.id,
    nome: adminNome,
    papel: "admin",
  });

  // Sempre encerra a sessão do usuário recém-criado — o navegador do
  // super_admin ficará deslogado e precisará entrar novamente.
  await supabase.auth.signOut();

  if (usuarioError) {
    console.error("criarEmpresa (insert usuario):", usuarioError.message);
    return {
      error: `O usuário de autenticação foi criado, mas houve um erro ao vinculá-lo à empresa. Detalhe: ${usuarioError.message}`,
    };
  }

  return { error: null, success: true };
}
