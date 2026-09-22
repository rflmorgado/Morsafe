"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Atualiza a tela periodicamente pra manter a bolinha de presença
 * (verde/laranja/vermelho) próxima do tempo real, sem precisar de
 * WebSocket/Realtime — router.refresh() só relê os Server Components da
 * rota atual (nova consulta ao banco), sem perder scroll nem fechar
 * modais abertos.
 */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
