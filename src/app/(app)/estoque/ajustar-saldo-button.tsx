"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { ajustarEstoque } from "./actions";

// Mesmo ícone de lápis de EditarLimiteButton — convenção já adotada neste
// projeto de cada arquivo de tela ficar autocontido, sem um módulo
// compartilhado só pra um ícone.
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
 * Lápis ao lado do SALDO ATUAL de cada EPI (diferente de EditarLimiteButton,
 * que ajusta só o limite de alerta) — correção pontual de um item só, a
 * qualquer momento, sem precisar abrir a contagem em lote inteira (ver
 * RegistrarContagemButton, pro fechamento de mês completo).
 *
 * Pedido do Rafael, 21/10/2026: ele conta o estoque de EPI no fim de cada
 * mês e não tinha como corrigir o saldo manualmente quando o que contou
 * não batia com o que o app calculou sozinho (ex.: entrega feita sem
 * registrar). Exige motivo (texto livre) — fica gravado no log de
 * auditoria junto com saldo anterior/novo, pra manter rastreável mesmo
 * sendo uma correção manual.
 */
export function AjustarSaldoButton({
  epiId,
  epiNome,
  saldoAtual,
}: {
  epiId: string;
  epiNome: string;
  saldoAtual: number;
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
    startTransition(async () => {
      const result = await ajustarEstoque({ error: null }, formData);
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
        title="Ajustar saldo atual (contagem física)"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-muted hover:text-foreground"
      >
        <EditIcon />
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title={`Ajustar saldo de estoque — ${epiNome}`}
      >
        <form key={formKey} action={handleSubmit} className="space-y-4">
          <input type="hidden" name="epi_id" value={epiId} />

          <p className="rounded-lg bg-surface-muted px-3.5 py-2.5 text-[12.5px] text-text-secondary">
            Saldo atual no sistema: <strong>{saldoAtual}</strong>. Informe o
            que você contou fisicamente — o saldo é corrigido e a diferença
            fica registrada no histórico, com o motivo.
          </p>

          <div>
            <label
              htmlFor="ajuste-saldo-contado"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Saldo contado
            </label>
            <input
              id="ajuste-saldo-contado"
              name="saldo_contado"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={saldoAtual}
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label
              htmlFor="ajuste-motivo"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Motivo do ajuste
            </label>
            <input
              id="ajuste-motivo"
              name="motivo"
              type="text"
              required
              placeholder="Ex.: Contagem física, divergência encontrada"
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
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
              {pending ? "Salvando..." : "Salvar ajuste"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
