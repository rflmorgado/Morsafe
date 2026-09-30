"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { atualizarLimiteAlerta } from "./actions";

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="M15 5l4 4" />
    </svg>
  );
}

/**
 * Botão discreto (só o ícone) na linha da tabela de Estoque — ajusta só o
 * limite de alerta de um EPI, sem abrir o formulário inteiro de edição do
 * EPI (que fica em /epis). Mesmo padrão de EditarEpiButton: modal simples,
 * useTransition, reseta o form via `formKey` depois de salvar.
 */
export function EditarLimiteButton({
  epiId,
  epiNome,
  limiteAtual,
}: {
  epiId: string;
  epiNome: string;
  limiteAtual: number;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    const novoLimite = Number(formData.get("limite_alerta"));
    startTransition(async () => {
      const result = await atualizarLimiteAlerta(epiId, novoLimite);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setFormKey((k) => k + 1);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ajustar limite de alerta"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface-muted hover:text-foreground"
      >
        <EditIcon />
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title={`Limite de alerta — ${epiNome}`}
      >
        <form key={formKey} action={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="limite-alerta"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Limite de alerta
            </label>
            <input
              id="limite-alerta"
              name="limite_alerta"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={limiteAtual}
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <p className="mt-1 text-[11.5px] text-text-muted">
              Quando o saldo atual ficar igual ou abaixo desse número, o EPI
              passa a aparecer destacado aqui e no card de estoque baixo do
              Dashboard.
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
