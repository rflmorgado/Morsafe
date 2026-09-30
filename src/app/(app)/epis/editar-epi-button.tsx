"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { updateEpi } from "./actions";
import { EpiFormFields } from "./epi-form-fields";
import type { Epi } from "@/lib/data/epis";

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

export function EditarEpiButton({ epi }: { epi: Epi }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateEpi({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        title="Editar EPI"
        aria-label={`Editar ${epi.nome}`}
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-brand-50 hover:text-brand-700"
      >
        <EditIcon />
      </button>

      <Modal open={open} onClose={handleClose} title="Editar EPI">
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={epi.id} />
          {/* Valor de custo_medio_atual no momento em que esta tela abriu —
              usado só pra updateEpi detectar se ele mudou em outro lugar
              enquanto a tela estava aberta (ver comentário em actions.ts) */}
          <input
            type="hidden"
            name="custo_medio_atual_original"
            value={epi.custoMedioAtual}
          />
          <EpiFormFields
            idPrefix={`edit-${epi.id}`}
            defaultValues={{
              nome: epi.nome,
              tipo: epi.tipo,
              exigeCa: epi.exigeCa,
              ca: epi.ca,
              caValidade: epi.caValidade,
              vidaUtilDias: epi.vidaUtilDias,
              fornecedor: epi.fornecedor,
              custoMedioAtual: epi.custoMedioAtual,
            }}
          />

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
              {pending ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
