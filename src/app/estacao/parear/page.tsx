import { ParearClient } from "./parear-client";

/**
 * Rota pública (ver PUBLIC_PATHS em src/lib/supabase/middleware.ts) — quem
 * abre este link é o navegador do aparelho sendo pareado, nunca um usuário
 * logado no MorSafe. Lê o código pelo searchParams no Server Component (em
 * vez de useSearchParams no cliente) só pra seguir o mesmo padrão do resto
 * do app.
 */
export default async function ParearEstacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo } = await searchParams;
  return <ParearClient codigo={codigo ?? ""} />;
}
