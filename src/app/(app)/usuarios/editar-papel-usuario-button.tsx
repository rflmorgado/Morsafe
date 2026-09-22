"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { atualizarPapelUsuario } from "./actions";

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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function EditarPapelUsuarioButton({
  usuarioId,
  usuarioNome,
  papelAtual,
}: {
  usuarioId: string;
  usuarioNome: string;
  papelAtual: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [papel, setPapel] = useState(papelAtual);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClose() {
    setOpen(false);
    setPapel(papelAtual);
    setError(null);
  }

  function handleSalvar() {
    setError(null);
    startTransition(async () => {
      const result = await atualizarPapelUsuario(usuarioId, papel);
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
        title="Editar papel"
        aria-label={`Editar papel de ${usuarioNome}`}
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-brand-50 hover:text-brand-700"
      >
        <EditIcon />
      </button>

      <Modal open={open} onClose={handleClose} title="Editar papel">
        <div className="space-y-4">
          <p className="text-[13.5px] text-text-secondary">
            Alterar o papel de{" "}
            <span className="font-semibold text-foreground">
              {usuarioNome}
            </span>
            .
          </p>

          <div>
            <label
              htmlFor="editar-usuario-papel"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Papel
            </label>
            <select
              id="editar-usuario-papel"
              value={papel}
              onChange={(e) => setPapel(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="leitura">Leitura — só visualiza</option>
              <option value="encarregado">
                Encarregado — cadastra, edita e importa
              </option>
              <option value="admin">
                Admin — tudo, inclusive desligar/excluir e gerenciar usuários
              </option>
            </select>
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
              type="button"
              onClick={handleSalvar}
              disabled={pending || papel === papelAtual}
              className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
