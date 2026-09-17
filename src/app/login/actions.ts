"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
};

export type ResetPasswordState = {
  error: string | null;
  success?: boolean;
};

/**
 * Descobre a URL base do site a partir dos headers da requisição, pra
 * montar o link de redirecionamento do e-mail de recuperação de senha sem
 * precisar de uma variável de ambiente fixa (funciona em preview, produção
 * ou qualquer domínio).
 */
async function getSiteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function requestPasswordReset(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const email = String(formData.get("resetEmail") ?? "").trim();

  if (!email) {
    return { error: "Informe seu e-mail." };
  }

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/redefinir-senha`,
  });

  // Não revelamos se o e-mail existe ou não na base, por segurança — a
  // mensagem de sucesso é sempre a mesma.
  if (error) {
    console.error("requestPasswordReset:", error.message);
  }

  return { error: null, success: true };
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "E-mail ou senha inválidos." };
  }

  redirect("/dashboard");
}
