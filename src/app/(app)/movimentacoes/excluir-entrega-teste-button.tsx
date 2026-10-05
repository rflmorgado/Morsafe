"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { excluirEntregaTeste } from "./actions";

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
 * Só aparece pra super_admin (ver movimentacoes/page.tsx) — exclusão de uma
 * entrega específica, pensada só pra corrigir lançamento de TESTE feito por
 * engano sobre um colaborador real (ver excluirEntregaTeste em actions.ts).
 * Não existe equivalente pra devolução/recusa: o caso que motivou isto foi
 * só com entrega, e alargar pra mais tabelas é uma decisão à parte.
 */
export function ExcluirEntregaTesteButton({
  entregaId,
  colaboradorNome,
  epiNome,
}: {
  entregaId: string;
  colaboradorNome: string;
  epiNome: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const confere = confirmacao.trim() === colaboradorNome;

  function handleClose() {
    setOpen(false);
    setConfirmacao("");
    setErro(null);
    setPending(false);
  }

  async function handleConfirmar() {
    setErro(null);
    setPending(true);

    const result = await excluirEntregaTeste(entregaId, confirmacao);

    if (result.error) {
      setErro(result.error);
      setPending(false);
      return;
    }

    setPending(false);
    setOpen(false);
    setConfirmacao("");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        title="Excluir entrega (apenas dado de teste)"
        aria-label={`Excluir entrega de ${epiNome} para ${colaboradorNome}`}
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition hover:bg-danger-bg hover:text-danger-text"
      >
        <TrashIcon />
      </button>

      <Modal open={open} onClose={handleClose} title="Excluir entrega de teste">
        <div className="space-y-4">
          <p className="rounded-lg bg-danger-bg px-3.5 py-3 text-[13px] font-medium text-danger-text">
            Isso apaga permanentemente a entrega de{" "}
            <span className="font-semibold">{epiNome}</span> para{" "}
            <span className="font-semibold">{colaboradorNome}</span> e repõe
            a quantidade no estoque. Use só para corrigir um lançamento de
            TESTE — não para uma entrega real: o histórico de entregas é
            imutável por design (CLAUDE.md, regra 3) justamente para
            conformidade com a NR-06.
          </p>

          <div>
            <label
              htmlFor="excluir-entrega-confirmacao"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Digite{" "}
              <span className="font-semibold text-foreground">
                {colaboradorNome}
              </span>{" "}
              para confirmar
            </label>
            <input
              id="excluir-entrega-confirmacao"
              type="text"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder={colaboradorNome}
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
              disabled={pending || !confere}
              onClick={handleConfirmar}
              className="rounded-lg bg-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Excluindo..." : "Excluir entrega"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
