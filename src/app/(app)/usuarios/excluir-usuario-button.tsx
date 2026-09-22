"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { excluirUsuarioDefinitivamente } from "./actions";

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
 * Exclusão definitiva — só aparece na tela pra usuários já desativados (ver
 * page.tsx). Diferente de desativar/reativar, esta ação exige digitar o
 * nome da pessoa pra confirmar, já que não tem volta. Não é o caminho pra
 * desligamento (esse é o "Desativar") — serve mais pra limpar uma conta
 * criada por engano ou de teste.
 */
export function ExcluirUsuarioButton({
  usuarioId,
  usuarioNome,
}: {
  usuarioId: string;
  usuarioNome: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nomeConfere =
    confirmacao.trim().toLowerCase() === usuarioNome.trim().toLowerCase();

  function handleClose() {
    setOpen(false);
    setConfirmacao("");
    setErro(null);
  }

  function handleConfirmar() {
    setErro(null);
    startTransition(async () => {
      const result = await excluirUsuarioDefinitivamente(usuarioId);
      if (result.error) {
        setErro(result.error);
        return;
      }
      setOpen(false);
      setConfirmacao("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        title="Excluir definitivamente"
        aria-label={`Excluir ${usuarioNome} definitivamente`}
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-danger-bg hover:text-danger-text"
      >
        <TrashIcon />
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Excluir usuário definitivamente"
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-danger-bg px-3.5 py-3 text-[13px] font-medium text-danger-text">
            Isso vai apagar o login de{" "}
            <span className="font-semibold">{usuarioNome}</span>{" "}
            permanentemente do sistema. Não é o mesmo que desativar — não tem
            como desfazer. Se essa pessoa já tiver registrado entrega,
            devolução, recusa ou entrada de estoque, a exclusão será
            bloqueada automaticamente para preservar o histórico.
          </p>

          <div>
            <label
              htmlFor="excluir-usuario-confirmacao"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Digite{" "}
              <span className="font-semibold text-foreground">
                {usuarioNome}
              </span>{" "}
              para confirmar
            </label>
            <input
              id="excluir-usuario-confirmacao"
              type="text"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder={usuarioNome}
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

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
              disabled={pending || !nomeConfere}
              className="rounded-lg bg-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Excluindo..." : "Excluir definitivamente"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
