"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/data/current-user";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

export type CriarEmpresaState = {
  error: string | null;
  success?: boolean;
};

/**
 * Cadastro de nova empresa cliente + seu primeiro usuário admin. Só pode
 * ser executado por um usuário com papel "super_admin" (dono do MorSafe) —
 * checado aqui no servidor, além de o item de menu só aparecer para esse
 * papel (ver NAV_ITEMS / app-shell.tsx).
 *
 * Usa o cliente com service role (mesmo padrão de usuarios/actions.ts,
 * ver lib/supabase/admin.ts) em vez do supabase.auth.signUp usado antes.
 * Dois motivos, os dois causavam falha real neste fluxo:
 *
 * 1) A tabela `usuarios` hoje só tem política de RLS pra cada usuário ler a
 *    própria linha, sem nenhuma política de inserção — o insert do passo 3
 *    com o client comum (sujeito a RLS) falhava sempre, deixando uma
 *    empresa órfã no banco e um login de autenticação "preso" (e-mail já
 *    registrado, sem conseguir tentar de novo com ele).
 * 2) auth.admin.createUser cria o usuário já com e-mail confirmado e sem
 *    trocar, nos cookies do navegador atual, a sessão de quem está logado
 *    — diferente do auth.signUp comum, que assumia a sessão do usuário
 *    recém-criado e exigia um signOut logo em seguida. O super_admin agora
 *    continua logado depois de cadastrar uma empresa nova.
 *
 * Cada passo que falha desfaz (best-effort) o que os passos anteriores já
 * tinham criado, pra nunca sobrar empresa órfã nem login de auth preso.
 *
 * Mensagens de erro pro usuário são sempre genéricas em português (o
 * detalhe técnico vai só pro log do servidor via console.error) — evita
 * vazar texto cru do Postgres/Supabase Auth pra quem está usando o
 * formulário, mesmo sendo um super_admin.
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

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("criarEmpresa (admin client):", e);
    return {
      error:
        "Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY ausente). Avise o suporte do MorSafe.",
    };
  }

  // 1) Cria a empresa primeiro (tabela sem RLS, insert sempre permitido).
  const { data: empresa, error: empresaError } = await admin
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
      error: "Não foi possível criar a empresa. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  // 2) Cria o usuário no Supabase Auth, já com e-mail confirmado.
  const { data: created, error: createError } = await admin.auth.admin.createUser(
    {
      email,
      password: senha,
      email_confirm: true,
    },
  );

  if (createError || !created.user) {
    // Best-effort: remove a empresa órfã já que o usuário não foi criado.
    await admin.from("empresas").delete().eq("id", empresa.id);
    const jaExiste =
      createError?.code === "email_exists" ||
      /already.*registered/i.test(createError?.message ?? "");
    console.error("criarEmpresa (createUser):", createError?.message);
    return {
      error: jaExiste
        ? "Já existe um usuário com esse e-mail."
        : "Não foi possível criar o usuário. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  // 3) Vincula o usuário à empresa como admin.
  const { error: usuarioError } = await admin.from("usuarios").insert({
    id: created.user.id,
    empresa_id: empresa.id,
    nome: adminNome,
    papel: "admin",
  });

  if (usuarioError) {
    // Best-effort: desfaz os dois passos anteriores, já que o cadastro como
    // um todo falhou — sem isso, sobra empresa órfã e login de auth preso.
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("empresas").delete().eq("id", empresa.id);
    console.error("criarEmpresa (insert usuario):", usuarioError.message);
    return {
      error: "Não foi possível vincular o usuário à empresa. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: empresa.id,
    tabela: "empresas",
    registroId: empresa.id,
    acao: "criado",
    usuarioId: requester.id,
    detalhes: { nome: empresaNome },
  });

  return { error: null, success: true };
}
