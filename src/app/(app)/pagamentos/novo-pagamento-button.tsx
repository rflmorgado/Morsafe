"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { criarPagamento } from "./actions";

/**
 * Formulário de novo pagamento, reaproveitado em dois lugares: na tela
 * consolidada /pagamentos (com o seletor de empresa visível, `empresas`
 * preenchido) e dentro de app/(app)/empresas/[id]/page.tsx (empresa já
 * conhecida e fixa — `empresaIdFixo`, sem seletor).
 */
export function NovoPagamentoButton({
  empresas,
  empresaIdFixo,
}: {
  empresas?: { id: string; nome: string }[];
  empresaIdFixo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [empresaId, setEmpresaId] = useState(empresaIdFixo ?? "");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClose() {
    setOpen(false);
    setError(null);
    setValor("");
    setDataVencimento("");
    setObservacao("");
    if (!empresaIdFixo) setEmpresaId("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await criarPagamento(
        empresaId,
        Number(valor),
        dataVencimento,
        observacao,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      handleClose();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
      >
        + Novo pagamento
      </button>

      <Modal open={open} onClose={handleClose} title="Novo pagamento">
        <form onSubmit={handleSubmit} className="space-y-4">
          {!empresaIdFixo && (
            <div>
              <label
                htmlFor="pagamento-empresa"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Empresa
              </label>
              <select
                id="pagamento-empresa"
                required
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Selecione…</option>
                {(empresas ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="pagamento-valor"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Valor (R$)
              </label>
              <input
                id="pagamento-valor"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label
                htmlFor="pagamento-vencimento"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Vencimento
              </label>
              <input
                id="pagamento-vencimento"
                type="date"
                required
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="pagamento-observacao"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Observação{" "}
              <span className="font-normal text-text-muted">(opcional)</span>
            </label>
            <input
              id="pagamento-observacao"
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: Mensalidade de outubro"
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
              {pending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
