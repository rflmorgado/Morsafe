"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { desligarColaborador } from "./actions";

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

export function DesligarColaboradorButton({
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
  const [fichaBaixada, setFichaBaixada] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setFichaBaixada(false);
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

    if (!fichaBaixada) {
      setErro("Baixe a ficha de entrega de EPI antes de continuar.");
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

    const result = await desligarColaborador(colaboradorId);

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
        title="Desligar colaborador"
        aria-label={`Desligar ${colaboradorNome}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-danger-bg hover:text-danger-text"
      >
        <TrashIcon />
      </button>

      <Modal open={open} onClose={handleClose} title="Desligar colaborador">
        <div className="space-y-4">
          <p className="text-[13.5px] text-text-secondary">
            Você está prestes a desligar{" "}
            <span className="font-semibold text-foreground">
              {colaboradorNome}
            </span>
            . Por segurança e conformidade com a NR-06, isso exige dois
            passos abaixo.
          </p>

          <div className="rounded-lg border border-border-subtle p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                1
              </span>
              <span className="text-[13px] font-semibold text-foreground">
                Baixe a ficha de entrega de EPI
              </span>
            </div>
            <a
              href={`/colaboradores/${colaboradorId}/ficha`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setFichaBaixada(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-2 text-[12.5px] font-semibold text-brand-700 transition hover:bg-brand-50"
            >
              ⬇ Baixar ficha (PDF)
            </a>
            {fichaBaixada && (
              <p className="mt-2 text-[12px] font-medium text-brand-700">
                ✓ Ficha baixada
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border-subtle p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                2
              </span>
              <span className="text-[13px] font-semibold text-foreground">
                Confirme sua senha
              </span>
            </div>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={!fichaBaixada}
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
              disabled={pending || !fichaBaixada || !senha}
              className="rounded-lg bg-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Desligando..." : "Confirmar desligamento"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
