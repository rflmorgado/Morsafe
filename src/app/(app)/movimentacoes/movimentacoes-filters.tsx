"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function MovimentacoesFilters({
  colaboradores,
  epis,
}: {
  colaboradores: { id: string; nome: string }[];
  epis: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // qualquer mudança de filtro volta para a página 1
    const qs = params.toString();
    startTransition(() => {
      router.push(`/movimentacoes${qs ? `?${qs}` : ""}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        defaultValue={searchParams.get("tipo") ?? ""}
        onChange={(e) => updateParams({ tipo: e.target.value || undefined })}
        className="min-w-[140px] max-w-[180px] flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        <option value="">Todos os tipos</option>
        <option value="entrega">Entregas</option>
        <option value="devolucao">Devoluções</option>
        <option value="recusa">Recusas</option>
      </select>

      <select
        defaultValue={searchParams.get("colaborador") ?? ""}
        onChange={(e) =>
          updateParams({ colaborador: e.target.value || undefined })
        }
        className="min-w-[160px] max-w-[220px] flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        <option value="">Todos os colaboradores</option>
        {colaboradores.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>

      <select
        defaultValue={searchParams.get("epi") ?? ""}
        onChange={(e) => updateParams({ epi: e.target.value || undefined })}
        className="min-w-[160px] max-w-[220px] flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        <option value="">Todos os EPIs</option>
        {epis.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1.5">
        <input
          type="date"
          defaultValue={searchParams.get("de") ?? ""}
          onChange={(e) => updateParams({ de: e.target.value || undefined })}
          className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <span className="text-[12px] text-text-muted">até</span>
        <input
          type="date"
          defaultValue={searchParams.get("ate") ?? ""}
          onChange={(e) => updateParams({ ate: e.target.value || undefined })}
          className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>
    </div>
  );
}
