"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { registrarEntradaEstoque } from "./actions";
import type { EpiAtivo } from "@/lib/data/movimentacoes";

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RegistrarEntradaButton({ epis }: { epis: EpiAtivo[] }) {
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
      const result = await registrarEntradaEstoque({ error: null }, formData);
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
        className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
      >
        + Registrar entrada de estoque
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Registrar entrada de estoque"
      >
        <form key={formKey} action={handleSubmit} className="space-y-4">
          <p className="rounded-lg bg-surface-muted px-3.5 py-2.5 text-[12.5px] text-text-secondary">
            Registre aqui cada compra recebida — o saldo e o custo médio do
            EPI são recalculados automaticamente a partir dessa entrada.
          </p>

          <div>
            <label
              htmlFor="entrada-epi"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              EPI
            </label>
            <select
              id="entrada-epi"
              name="epi_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="" disabled>
                Selecione…
              </option>
              {epis.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                  {e.ca ? ` — C.A. ${e.ca}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="entrada-quantidade"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Quantidade
              </label>
              <input
                id="entrada-quantidade"
                name="quantidade"
                type="number"
                min="1"
                step="1"
                required
                placeholder="Ex.: 50"
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label
                htmlFor="entrada-preco"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Preço unitário (R$)
              </label>
              <input
                id="entrada-preco"
                name="preco_unitario"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0,00"
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="entrada-fornecedor"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Fornecedor{" "}
                <span className="font-normal text-text-muted">(opcional)</span>
              </label>
              <input
                id="entrada-fornecedor"
                name="fornecedor"
                type="text"
                placeholder="Nome do fornecedor"
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label
                htmlFor="entrada-nota"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Nota fiscal{" "}
                <span className="font-normal text-text-muted">(opcional)</span>
              </label>
              <input
                id="entrada-nota"
                name="nota_fiscal"
                type="text"
                placeholder="Número da NF"
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="entrada-data"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Data da compra
            </label>
            <input
              id="entrada-data"
              name="data_compra"
              type="date"
              defaultValue={hojeISO()}
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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
              {pending ? "Salvando..." : "Registrar entrada"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
