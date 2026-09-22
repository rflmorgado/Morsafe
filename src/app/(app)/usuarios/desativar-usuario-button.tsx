"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { desativarUsuario } from "./actions";

function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

/**
 * Desativa o acesso de um colega — não apaga nada que essa pessoa já
 * cadastrou no sistema, só bloqueia o login dela (checado no middleware).
 * Sem reautenticação por senha: é uma ação reversível (tem "reativar"),
 * diferente de desligar colaborador.
 */
export function DesativarUsuarioButton({
  usuarioId,
  usuarioNome,
}: {
  usuarioId: string;
  usuarioNome: string;
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
      const result = await desativarUsuario(usuarioId);
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
        title="Desativar acesso"
        aria-label={`Desativar acesso de ${usuarioNome}`}
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-danger-bg hover:text-danger-text"
      >
        <TrashIcon />
      </button>

      <Modal open={open} onClose={handleClose} title="Desativar acesso">
        <div className="space-y-4">
          <p className="text-[13.5px] text-text-secondary">
            Você está prestes a desativar o acesso de{" "}
            <span className="font-semibold text-foreground">
              {usuarioNome}
            </span>
            . Ela não vai mais conseguir entrar no MorSafe, mas nada do que
            já cadastrou é apagado. Dá pra reativar depois.
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
              className="rounded-lg bg-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Desativando..." : "Confirmar desativação"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
