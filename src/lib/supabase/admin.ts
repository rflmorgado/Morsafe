import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase com a service role key — só pode ser usado no servidor
 * (Server Actions, Route Handlers), NUNCA importado por um componente
 * cliente ("use client"). Ignora o RLS (Row Level Security) por completo,
 * então toda checagem de permissão — quem pode fazer o quê, e só dentro da
 * própria empresa — precisa acontecer no código ANTES de qualquer consulta
 * com este cliente. Nunca trate o RLS como a barreira aqui.
 *
 * Usado hoje pela gestão de usuários (src/app/(app)/usuarios): criar um
 * login novo sem derrubar a sessão de quem está criando (auth.admin.
 * createUser, diferente do auth.signUp comum usado em /setup-empresa) e
 * listar/editar/desativar usuários da própria empresa sem depender de uma
 * política de RLS específica pra isso (hoje só existe uma política pra
 * cada usuário ler a própria linha).
 *
 * Exige a variável de ambiente SUPABASE_SERVICE_ROLE_KEY (Project Settings
 * > API > service_role no painel do Supabase) — igual a
 * NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, mas nunca com o prefixo NEXT_PUBLIC_,
 * pra nunca ser exposta ao navegador.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione essa variável de ambiente no Vercel (Settings > Environment Variables) com o valor da chave 'service_role' do Supabase (Project Settings > API).",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
