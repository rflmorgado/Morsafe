"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ColaboradoresFilters({
  setores,
}: {
  setores: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // qualquer mudança de filtro volta para a página 1
    const qs = params.toString();
    router.push(`/colaboradores${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-2 sm:flex-row">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParams({ q: q.trim() || undefined });
        }}
        className="max-w-[320px] flex-1"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar colaborador…"
          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </form>

      <select
        defaultValue={searchParams.get("setor") ?? ""}
        onChange={(e) => updateParams({ setor: e.target.value || undefined })}
        className="max-w-[200px] rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        <option value="">Todos os setores</option>
        {setores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
