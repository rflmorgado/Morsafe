"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { reativarColaborador } from "./actions";

function RestoreIcon() {
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
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

/**
 * Simétrico ao desligamento — volta o colaborador para status 'ativo'
 * (ex.: readmissão). Não exige reautenticação por senha nem download de
 * ficha, já que reativar não tem o mesmo peso de conformidade que desligar.
 */
export function ReativarColaboradorButton({
  colaboradorId,
  colaboradorNome,
}: {
  colaboradorId: string;
  colaboradorNome: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClose() {
    setOpen(false);
    setErro(null);
  }

  function handleConfirmar() {
    setErro(null);
    startTransition(async () => {
      const result = await reativarColaborador(colaboradorId);
      if (result.error) {
        setErro(result.error);
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
        title="Reativar colaborador"
        aria-label={`Reativar ${colaboradorNome}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-brand-50 hover:text-brand-700"
      >
        <RestoreIcon />
      </button>

      <Modal open={open} onClose={handleClose} title="Reativar colaborador">
        <div className="space-y-4">
          <p className="text-[13.5px] text-text-secondary">
            Você está prestes a reativar{" "}
            <span className="font-semibold text-foreground">
              {colaboradorNome}
            </span>
            . O status voltará para &ldquo;Ativo&rdquo; e ele passará a
            aparecer novamente no controle de EPI.
          </p>

          {erro && (
            <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
              {erro}
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
              type="button"
              onClick={handleConfirmar}
              disabled={pending}
              className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Reativando..." : "Confirmar reativação"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
