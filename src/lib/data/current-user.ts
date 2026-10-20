import { cache } from "react";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";

/**
 * Usuário logado + empresa. Usado nos Server Components das rotas
 * protegidas para saudação e para qualquer filtro extra no cliente
 * (o isolamento real de dados é garantido pelo RLS no banco).
 *
 * Envolvida em `cache()` (API do próprio React, não o `fetch` cache do
 * Next): hoje ela é chamada duas vezes em toda navegação — uma em
 * app/(app)/layout.tsx (pra montar a barra lateral) e outra de novo dentro
 * de cada page.tsx (pra conferir o papel do usuário, ex. empresas/page.tsx,
 * pagamentos/page.tsx) — cada chamada fazendo seu próprio
 * `auth.getUser()` + select em `usuarios`. `cache()` faz com que as
 * chamadas dentro de UMA MESMA renderização (layout + page da mesma
 * navegação) reaproveitem o mesmo resultado em vez de repetir as duas
 * consultas ao Supabase; a cada navegação nova o cache é descartado e tudo
 * busca de novo, então nenhum dado fica desatualizado.
 */
export const getCurrentUser = cache(async function getCurrentUser() {
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

  // Marca todo erro capturado pelo Sentry nesta requisição com a empresa e
  // o papel do usuário logado, pra conseguirmos filtrar os erros por
  // cliente (e priorizar alertas de empresas pagantes reais, não da
  // "MorSafe Teste") sem precisar de um projeto Sentry separado por empresa.
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
