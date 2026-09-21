"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { excluirColaboradorDefinitivamente } from "./actions";

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
 * Exclusão definitiva — só aparece na tela para colaboradores já desligados
 * (ver page.tsx). Diferente de desligar, aqui não tem "reativar" depois, por
 * isso o fluxo pede confirmação explícita (checkbox) + senha, em vez de
 * download de ficha (a ficha já devia ter sido baixada no desligamento).
 */
export function ExcluirColaboradorButton({
  colaboradorId,
  colaboradorNome,
  userEmail,
}: {
  colaboradorId: string;
  colaboradorNome: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setConfirmado(false);
    setSenha("");
    setErro(null);
    setPending(false);
  }

  function handleClose() {
    setOpen(false);
    reset();
  }

  async function handleConfirmar() {
    setErro(null);

    if (!confirmado) {
      setErro("Marque a confirmação antes de continuar.");
      return;
    }
    if (!senha) {
      setErro("Digite sua senha para confirmar.");
      return;
    }

    setPending(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: senha,
    });

    if (authError) {
      setErro("Senha incorreta. Tente novamente.");
      setPending(false);
      return;
    }

    const result = await excluirColaboradorDefinitivamente(colaboradorId);

    if (result.error) {
      setErro(result.error);
      setPending(false);
      return;
    }

    setPending(false);
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        title="Excluir definitivamente"
        aria-label={`Excluir ${colaboradorNome} definitivamente`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-danger-bg hover:text-danger-text"
      >
        <TrashIcon />
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Excluir colaborador definitivamente"
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-danger-bg px-3.5 py-3 text-[13px] font-medium text-danger-text">
            Isso vai apagar o cadastro de{" "}
            <span className="font-semibold">{colaboradorNome}</span>{" "}
            permanentemente do sistema. Não é o mesmo que desligar — não tem
            como desfazer. Se ele tiver qualquer histórico de entrega,
            devolução ou recusa de EPI, a exclusão será bloqueada
            automaticamente para preservar a conformidade com a NR-06.
          </p>

          <label className="flex items-start gap-2 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border-strong text-danger-text focus:ring-danger-text"
            />
            <span>
              Sim, quero excluir <strong>{colaboradorNome}</strong>{" "}
              definitivamente. Sei que essa ação não pode ser desfeita.
            </span>
          </label>

          <div className="rounded-lg border border-border-subtle p-3.5">
            <label
              htmlFor="excluir-colaborador-senha"
              className="mb-2 block text-[13px] font-semibold text-foreground"
            >
              Confirme sua senha
            </label>
            <input
              id="excluir-colaborador-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={!confirmado}
              placeholder="Sua senha de login"
              autoComplete="current-password"
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
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
              disabled={pending || !confirmado || !senha}
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
