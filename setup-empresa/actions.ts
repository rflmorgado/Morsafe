"use server";

import { createClient } from "@/lib/supabase/server";

export type CriarEmpresaState = {
  error: string | null;
  success?: boolean;
};

/**
 * Ferramenta interna (não divulgada publicamente) para cadastrar uma nova
 * empresa cliente + seu primeiro usuário admin. Protegida por uma senha de
 * acesso (EMPRESA_SETUP_SECRET) checada aqui no servidor, além de a rota
 * não aparecer em nenhum lugar do app. Ver PUBLIC_PATHS em
 * src/lib/supabase/middleware.ts.
 */
export async function criarEmpresa(
  _prev: CriarEmpresaState,
  formData: FormData,
): Promise<CriarEmpresaState> {
  const senhaAcesso = String(formData.get("senhaAcesso") ?? "");
  const secret = process.env.EMPRESA_SETUP_SECRET;

  if (!secret) {
    return {
      error:
        "EMPRESA_SETUP_SECRET não está configurada no servidor. Configure a variável de ambiente antes de usar esta ferramenta.",
    };
  }
  if (senhaAcesso !== secret) {
    return { error: "Senha de acesso incorreta." };
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
    return { error: "Não foi possível criar a empresa. Tente novamente." };
  }

  // 2) Cria o usuário no Supabase Auth.
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
          : "Não foi possível criar o usuário. Tente novamente.",
    };
  }

  // Se a confirmação de e-mail estiver ativa no Supabase Auth, o signUp não
  // retorna uma sessão imediata — e sem sessão o insert em "usuarios" não
  // passa pela RLS (que exige id = auth.uid()). Nesse caso, é preciso
  // desativar "Confirm email" em Authentication > Settings no Supabase.
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

  // Sempre encerra a sessão do usuário recém-criado antes de sair daqui,
  // para não deixar o navegador de quem está usando esta ferramenta
  // autenticado como a nova empresa cliente.
  await supabase.auth.signOut();

  if (usuarioError) {
    console.error("criarEmpresa (insert usuario):", usuarioError.message);
    return {
      error:
        "O usuário de autenticação foi criado, mas houve um erro ao vinculá-lo à empresa. Verifique manualmente no Supabase.",
    };
  }

  return { error: null, success: true };
}
