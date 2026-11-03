"use client";

import { useRef, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { registrarEntradaEstoque } from "./actions";
import type { EpiAtivo } from "@/lib/data/movimentacoes";

// Um item da entrada (EPI + quantidade + preço unitário) — a mesma compra/
// nota/entrega pode ter vários, pedido do Rafael em 03/11/2026 ("em algumas
// vezes compramos mais de um item por nota, por entrega, ideal seria poder
// inserir todos de uma vez no estoque... adicionar mais itens"). `key` é só
// identidade de UI (pra React/remover item), nunca vai pro servidor — mesmo
// raciocínio de ItemFormulario em movimentacoes/registrar-entrega-button.tsx.
type ItemFormulario = {
  key: number;
  epiId: string;
  quantidade: number;
  precoUnitario: string;
};

function itemVazio(key: number): ItemFormulario {
  return { key, epiId: "", quantidade: 1, precoUnitario: "" };
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RegistrarEntradaButton({
  epis,
  variant = "solid",
}: {
  epis: EpiAtivo[];
  // "solid" é o padrão (usado em Estoque, onde este é o único botão de ação
  // da toolbar — merece destaque). "outline" é pro Dashboard, onde este
  // botão divide o card "Ações rápidas" com Registrar devolução — dois
  // botões sólidos lado a lado, ou um sólido do lado de um discreto,
  // ficava inconsistente (ver conversa com Rafael, 01/10/2026).
  variant?: "solid" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  // Lista de itens da entrada — sempre começa com um item em branco; o
  // botão "+ Adicionar outro item" empilha mais, nunca menos de um. Mesmo
  // padrão de `itens` em movimentacoes/registrar-entrega-button.tsx.
  const [itens, setItens] = useState<ItemFormulario[]>(() => [itemVazio(0)]);
  const proximaKeyRef = useRef(1);

  function resetarItens() {
    setItens([itemVazio(0)]);
    proximaKeyRef.current = 1;
  }

  function adicionarItem() {
    const key = proximaKeyRef.current++;
    setItens((prev) => [...prev, itemVazio(key)]);
  }

  function removerItem(key: number) {
    setItens((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  }

  function atualizarItem(key: number, patch: Partial<ItemFormulario>) {
    setItens((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function handleClose() {
    setOpen(false);
    setError(null);
    resetarItens();
  }

  // Itens incompletos (sem EPI ou sem preço preenchido) travam o envio —
  // conferido antes de chamar o servidor, pra dar o aviso na hora em vez de
  // só depois de um vai-e-volta.
  function itensIncompletos() {
    return itens.some((i) => !i.epiId || i.precoUnitario.trim() === "");
  }

  function handleSubmit(formData: FormData) {
    setError(null);

    if (itensIncompletos()) {
      setError("Preencha o EPI e o preço unitário de todos os itens.");
      return;
    }

    const fornecedor = String(formData.get("fornecedor") ?? "");
    const notaFiscal = String(formData.get("nota_fiscal") ?? "");
    const dataCompra = String(formData.get("data_compra") ?? "");

    startTransition(async () => {
      const fd = new FormData();
      fd.set("fornecedor", fornecedor);
      fd.set("nota_fiscal", notaFiscal);
      fd.set("data_compra", dataCompra);
      fd.set(
        "itens",
        JSON.stringify(
          itens.map((i) => ({
            epi_id: i.epiId,
            quantidade: i.quantidade,
            preco_unitario: Number(i.precoUnitario.replace(",", ".")),
          })),
        ),
      );

      const result = await registrarEntradaEstoque({ error: null }, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setFormKey((k) => k + 1);
      resetarItens();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "outline"
            ? "rounded-lg border border-border-strong px-4 py-2.5 text-[13.5px] font-semibold text-foreground transition hover:bg-surface-muted"
            : "rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
        }
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
            EPI são recalculados automaticamente a partir dessa entrada. Se a
            mesma nota trouxe mais de um EPI, adicione todos de uma vez.
          </p>

          <div className="space-y-3">
            <label className="block text-[12.5px] font-semibold text-text-secondary">
              Itens da entrada
            </label>

            {itens.map((item, index) => (
              <div
                key={item.key}
                className="space-y-3 rounded-lg border border-border-strong bg-surface-muted/40 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">
                    Item {index + 1}
                  </span>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerItem(item.key)}
                      className="text-[12px] font-semibold text-danger-text hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
                    EPI
                  </label>
                  <select
                    required
                    value={item.epiId}
                    onChange={(e) =>
                      atualizarItem(item.key, { epiId: e.target.value })
                    }
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      required
                      placeholder="Ex.: 50"
                      value={item.quantidade}
                      onChange={(e) =>
                        atualizarItem(item.key, {
                          quantidade: Number(e.target.value) || 1,
                        })
                      }
                      className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
                      Preço unitário (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0,00"
                      value={item.precoUnitario}
                      onChange={(e) =>
                        atualizarItem(item.key, { precoUnitario: e.target.value })
                      }
                      className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={adicionarItem}
              className="w-full rounded-lg border border-dashed border-border-strong px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-700 transition hover:bg-brand-50"
            >
              + Adicionar outro item
            </button>
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
              disabled={pending || itensIncompletos()}
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
