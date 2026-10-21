"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import {
  registrarContagemEstoque,
  type ContagemEstoqueFalha,
} from "./actions";
import type { ItemEstoqueParaAjuste } from "@/lib/data/estoque";

function motivoPadrao() {
  const mesAno = new Date().toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return `Contagem mensal — ${mesAno}`;
}

/**
 * Contagem de estoque em lote — pro fechamento de mês (pedido do Rafael,
 * 21/10/2026): lista TODO o catálogo ativo de uma vez (listEstoqueParaAjuste,
 * sem paginação — diferente da tabela principal de /estoque), com um campo
 * por EPI já preenchido com o saldo atual. Só precisa editar os itens que
 * divergem da contagem física; o resto fica como está e não gera ajuste
 * nenhum (ver registrarContagemEstoque, em actions.ts).
 *
 * Inputs não controlados (lidos do FormData no submit, não via useState por
 * item) — evita re-render de uma lista que pode ter dezenas de EPIs a cada
 * tecla digitada em qualquer um deles.
 */
export function RegistrarContagemButton({
  itens,
}: {
  itens: ItemEstoqueParaAjuste[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);
  const [resultado, setResultado] = useState<{
    ajustados: number;
    semMudanca: number;
    falhas: ContagemEstoqueFalha[];
  } | null>(null);
  // Lazy initializer (função, não motivoPadrao() direto) — calcula só na
  // primeira render do componente, não a cada render.
  const [motivoInicial, setMotivoInicial] = useState(motivoPadrao);

  function handleClose() {
    setOpen(false);
    setError(null);
    setResultado(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    const motivo = String(formData.get("motivo") ?? "").trim();

    const itensPreenchidos = itens
      .map((item) => {
        const raw = formData.get(`saldo_${item.id}`);
        return { epiId: item.id, saldoContado: Number(raw) };
      })
      .filter((i) => Number.isFinite(i.saldoContado) && i.saldoContado >= 0);

    startTransition(async () => {
      const result = await registrarContagemEstoque(itensPreenchidos, motivo);
      if (result.error) {
        setError(result.error);
        return;
      }
      setResultado({
        ajustados: result.ajustados ?? 0,
        semMudanca: result.semMudanca ?? 0,
        falhas: result.falhas ?? [],
      });
    });
  }

  function handleAbrirNova() {
    setMotivoInicial(motivoPadrao());
    setFormKey((k) => k + 1);
    setResultado(null);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleAbrirNova}
        className="rounded-lg border border-border-strong px-4 py-2.5 text-[13.5px] font-semibold text-foreground transition hover:bg-surface-muted"
      >
        ☑ Registrar contagem de estoque
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Registrar contagem de estoque"
      >
        {resultado ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[13.5px] font-medium text-brand-700">
              ✓ {resultado.ajustados === 0
                ? "Nenhum saldo precisou de correção"
                : `${resultado.ajustados} ${resultado.ajustados === 1 ? "saldo corrigido" : "saldos corrigidos"}`}
              {resultado.semMudanca > 0
                ? ` · ${resultado.semMudanca} ${resultado.semMudanca === 1 ? "item confirmado, sem diferença" : "itens confirmados, sem diferença"}.`
                : "."}
            </p>

            {resultado.falhas.length > 0 && (
              <div className="space-y-1.5 rounded-lg bg-danger-bg px-3.5 py-3">
                <p className="text-[13px] font-semibold text-danger-text">
                  {resultado.falhas.length}{" "}
                  {resultado.falhas.length === 1
                    ? "item não pôde ser ajustado"
                    : "itens não puderam ser ajustados"}
                  :
                </p>
                <ul className="max-h-40 space-y-0.5 overflow-y-auto text-[12.5px] text-danger-text">
                  {resultado.falhas.map((f, i) => (
                    <li key={`${f.epiNome}-${i}`}>
                      {f.epiNome}: {f.erro}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <form key={formKey} action={handleSubmit} className="space-y-4">
            <p className="text-[13px] text-text-secondary">
              O saldo atual de cada EPI já vem preenchido — edite só os
              itens em que a contagem física deu diferente. O que ficar
              igual não é alterado nem entra no histórico.
            </p>

            <div>
              <label
                htmlFor="contagem-motivo"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Motivo / identificação da contagem
              </label>
              <input
                id="contagem-motivo"
                name="motivo"
                type="text"
                required
                defaultValue={motivoInicial}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div className="max-h-72 space-y-0 overflow-y-auto rounded-lg border border-border-subtle">
              {itens.length === 0 ? (
                <p className="px-3.5 py-3 text-[12.5px] text-text-muted">
                  Nenhum EPI ativo cadastrado.
                </p>
              ) : (
                itens.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b border-border-subtle px-3.5 py-2.5 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-[13px] font-medium text-foreground"
                        title={item.nome}
                      >
                        {item.nome}
                      </p>
                      <p className="text-[11.5px] text-text-muted">
                        Atual: {item.saldoAtual}
                        {item.ca ? ` · C.A. ${item.ca}` : ""}
                      </p>
                    </div>
                    <input
                      type="number"
                      name={`saldo_${item.id}`}
                      min="0"
                      step="1"
                      defaultValue={item.saldoAtual}
                      aria-label={`Saldo contado de ${item.nome}`}
                      className="w-20 shrink-0 rounded-lg border border-border-strong bg-surface px-2.5 py-2 text-right text-[13px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                ))
              )}
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
                disabled={pending || itens.length === 0}
                className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Salvando..." : "Salvar contagem"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
