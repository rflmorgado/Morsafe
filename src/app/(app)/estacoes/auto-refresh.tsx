"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Atualiza a tela periodicamente pra manter a bolinha de "aparelho
 * conectado agora / visto há pouco / offline" próxima do tempo real — mesmo
 * padrão de src/app/(app)/usuarios/auto-refresh.tsx, só que com intervalo
 * mais curto porque o limiar de "online" aqui também é bem mais curto (ver
 * statusAparelho em page.tsx).
 */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
