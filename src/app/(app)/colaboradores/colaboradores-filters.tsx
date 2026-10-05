"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 350;

export function ColaboradoresFilters({
  setores,
}: {
  setores: { id: string; nome: string }[];
}) {
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
      router.push(`/colaboradores${qs ? `?${qs}` : ""}`);
    });
  }

  function handleQChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Busca automática enquanto digita — a lista (já ordenada A-Z) vai
    // diminuindo sozinha conforme o texto fica mais específico.
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
          placeholder="Buscar colaborador…"
          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        {isPending && (
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-text-muted">
            buscando…
          </span>
        )}
      </form>

      <select
        defaultValue={searchParams.get("setor") ?? ""}
        onChange={(e) => updateParams({ setor: e.target.value || undefined })}
        className="min-w-[140px] max-w-[200px] flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        <option value="">Todos os setores</option>
        {setores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>

      {/* Padrão é "ativo" (ver listColaboradores) — selecionar "ativo" de
          novo remove o parâmetro da URL (mesmo efeito, URL mais limpa).
          "Todos os status" é a única forma de ver ativos e inativos juntos. */}
      <select
        defaultValue={searchParams.get("status") ?? "ativo"}
        onChange={(e) =>
          updateParams({
            status: e.target.value === "ativo" ? undefined : e.target.value,
          })
        }
        className="min-w-[120px] max-w-[160px] flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        <option value="ativo">Somente ativos</option>
        <option value="inativo">Somente inativos</option>
        <option value="todos">Todos os status</option>
      </select>

      {/* Isola quem está sem a data de Integração/NR-06 preenchida — pedido
          do Rafael pra achar rápido, numa planilha importada com dezenas de
          linhas, só quem precisa de edição manual desse campo. */}
      <select
        defaultValue={searchParams.get("nr06") ?? ""}
        onChange={(e) => updateParams({ nr06: e.target.value || undefined })}
        className="min-w-[150px] max-w-[220px] flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        <option value="">NR-06: todos</option>
        <option value="pendente">NR-06: só pendentes</option>
      </select>
    </div>
  );
}
