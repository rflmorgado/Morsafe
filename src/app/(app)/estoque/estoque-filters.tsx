"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TIPOS_EPI } from "@/lib/data/epi-tipos";

const DEBOUNCE_MS = 350;

/**
 * Busca por nome + filtro por tipo, mesmo padrão de EpisFilters — sem
 * filtro de status aqui, porque Estoque sempre mostra só EPIs ativos (ver
 * comentário em lib/data/estoque.ts).
 */
export function EstoqueFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // qualquer mudança de filtro volta para a página 1
    const qs = params.toString();
    startTransition(() => {
      router.push(`/estoque${qs ? `?${qs}` : ""}`);
    });
  }

  function handleQChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ q: value.trim() || undefined });
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (debounceRef.current) clearTimeout(debounceRef.current);
          updateParams({ q: q.trim() || undefined });
        }}
        className="relative w-full min-w-[180px] max-w-[320px] flex-1 sm:w-auto"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => handleQChange(e.target.value)}
          placeholder="Buscar EPI…"
          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        {isPending && (
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-text-muted">
            buscando…
          </span>
        )}
      </form>

      <select
        defaultValue={searchParams.get("tipo") ?? ""}
        onChange={(e) => updateParams({ tipo: e.target.value || undefined })}
        className="min-w-[160px] max-w-[220px] flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        <option value="">Todos os tipos</option>
        {TIPOS_EPI.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
