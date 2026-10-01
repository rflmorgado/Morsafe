"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { definirLimiteColaboradores } from "./actions";

/**
 * Define (ou remove) o limite de colaboradores ATIVOS incluído no plano da
 * empresa — campo em branco volta pra "sem limite definido" (sem alerta).
 * Ver comentário de definirLimiteColaboradores em actions.ts pro porquê
 * disso existir e pro tratamento do caso em que a coluna nova no banco
 * ainda não foi criada.
 */
export function DefinirLimiteButton({
  empresaId,
  limiteAtual,
}: {
  empresaId: string;
  limiteAtual: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [limite, setLimite] = useState(
    limiteAtual !== null ? String(limiteAtual) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClose() {
    setOpen(false);
    setError(null);
    setLimite(limiteAtual !== null ? String(limiteAtual) : "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const limiteTrim = limite.trim();
    startTransition(async () => {
      const result = await definirLimiteColaboradores(
        empresaId,
        limiteTrim === "" ? null : Number(limiteTrim),
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border-strong px-4 py-2.5 text-[13.5px] font-semibold text-foreground transition hover:bg-surface-muted"
      >
        {limiteAtual !== null
          ? "Editar limite de colaboradores"
          : "Definir limite de colaboradores"}
      </button>

      <Modal open={open} onClose={handleClose} title="Limite de colaboradores">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="limite-colaboradores"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Colaboradores ativos incluídos no plano
            </label>
            <input
              id="limite-colaboradores"
              type="number"
              min="1"
              step="1"
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
              placeholder="Sem limite definido"
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <p className="mt-1.5 text-[12px] text-text-muted">
              Deixe em branco para não ter alerta de limite nesta empresa.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
