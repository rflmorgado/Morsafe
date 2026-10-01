"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { alternarAtivoEmpresa } from "./actions";

/**
 * Ativa/desativa o acesso de uma empresa cliente. Desativar tem efeito de
 * verdade (bloqueia login de todos os usuários dela, ver middleware.ts),
 * por isso pede confirmação num modal; reativar é reversível e de baixo
 * risco, então age direto no clique.
 */
export function AlternarAtivoButton({
  empresaId,
  empresaNome,
  ativo,
}: {
  empresaId: string;
  empresaNome: string;
  ativo: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function executar(novoValor: boolean) {
    setErro(null);
    startTransition(async () => {
      const result = await alternarAtivoEmpresa(empresaId, novoValor);
      if (result.error) {
        setErro(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!ativo) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => executar(true)}
        className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Reativando..." : "Reativar empresa"}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border-strong px-4 py-2.5 text-[13.5px] font-semibold text-danger-text transition hover:bg-danger-bg"
      >
        Desativar empresa
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Desativar empresa"
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-danger-bg px-3.5 py-3 text-[13px] font-medium text-danger-text">
            Nenhum usuário de{" "}
            <span className="font-semibold">{empresaNome}</span> vai
            conseguir fazer login enquanto a empresa estiver desativada. Os
            dados continuam intactos — só o acesso é bloqueado. Dá pra
            reativar a qualquer momento.
          </p>

          {erro && (
            <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => executar(false)}
              className="rounded-lg bg-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Desativando..." : "Desativar empresa"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
