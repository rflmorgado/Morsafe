import { cache } from "react";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import type { PapelUsuario } from "@/types/database";

/**
 * Usuário logado + empresa. Usado nos Server Components das rotas
 * protegidas para saudação e para qualquer filtro extra no cliente
 * (o isolamento real de dados é garantido pelo RLS no banco).
 *
 * Envolvida em `cache()` (API do próprio React, não o `fetch` cache do
 * Next): dentro de UMA MESMA renderização (layout + page da mesma
 * navegação, ou uma Server Action), chamadas repetidas reaproveitam o
 * mesmo resultado; a cada navegação/ação nova o cache é descartado e tudo
 * busca de novo, então nenhum dado fica desatualizado.
 *
 * CAMINHO RÁPIDO (21/10/2026, pedido do Rafael — "transições de tela e
 * salvar estão demorando"): o middleware (lib/supabase/middleware.ts) já
 * valida a sessão E busca este mesmo perfil em TODO request protegido
 * (página ou Server Action), repassando o resultado via headers. Antes
 * desta mudança, esta função ignorava isso e refazia do zero o mesmo
 * auth.getUser() + select em usuarios — 2 idas-e-voltas ao Supabase a mais
 * em cima das que o middleware já tinha acabado de pagar, em toda
 * navegação e em todo salvamento. Lendo os headers primeiro, essas duas
 * consultas somem por completo no caminho normal.
 *
 * O fallback abaixo (busca direto no Supabase, do jeito antigo) continua
 * existindo só como rede de segurança, pra qualquer contexto em que o
 * middleware por algum motivo não tenha rodado antes — não deveria
 * acontecer em nenhuma rota protegida normal, mas é mais seguro manter do
 * que deixar a função quebrar se os headers não vierem.
 */
export const getCurrentUser = cache(async function getCurrentUser() {
  const headerList = await headers();
  const userId = headerList.get("x-morsafe-user-id");

  if (userId) {
    const email = decodeURIComponent(
      headerList.get("x-morsafe-user-email") ?? "",
    );
    const nome =
      decodeURIComponent(headerList.get("x-morsafe-user-nome") ?? "") ||
      email ||
      "Usuário";
    const papel = (headerList.get("x-morsafe-user-papel") ??
      "leitura") as PapelUsuario;
    const empresaId = headerList.get("x-morsafe-empresa-id") || null;
    const empresaNome =
      decodeURIComponent(headerList.get("x-morsafe-empresa-nome") ?? "") ||
      null;

    Sentry.setUser({ id: userId, email: email || undefined });
    Sentry.setTag("empresa_id", empresaId ?? "sem_empresa");
    Sentry.setTag("empresa_nome", empresaNome ?? "sem_empresa");
    Sentry.setTag("papel", papel);

    return { id: userId, email, nome, papel, empresaId, empresaNome };
  }

  // Rede de segurança — ver comentário acima. Mantém exatamente o
  // comportamento de antes desta mudança.
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

  const empresaNome =
    (perfil?.empresas as unknown as { nome: string } | null)?.nome ?? null;

  Sentry.setUser({ id: user.id, email: user.email ?? undefined });
  Sentry.setTag("empresa_id", perfil?.empresa_id ?? "sem_empresa");
  Sentry.setTag("empresa_nome", empresaNome ?? "sem_empresa");
  Sentry.setTag("papel", perfil?.papel ?? "leitura");

  return {
    id: user.id,
    email: user.email ?? "",
    nome: perfil?.nome ?? user.email ?? "Usuário",
    papel: perfil?.papel ?? "leitura",
    empresaId: perfil?.empresa_id ?? null,
    empresaNome,
  };
});
