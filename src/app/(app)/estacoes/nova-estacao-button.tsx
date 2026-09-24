"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { PareamentoModal } from "./pareamento-modal";
import { criarEstacaoAssinatura, type PareamentoInfo } from "./actions";

export function NovaEstacaoButton() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pareamento, setPareamento] = useState<PareamentoInfo | null>(null);

  function reset() {
    setNome("");
    setError(null);
    setPareamento(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const nomeDigitado = String(formData.get("nome") ?? "");
      const result = await criarEstacaoAssinatura(nomeDigitado);
      if (result.error || !result.pareamento) {
        setError(result.error ?? "Não foi possível criar a estação.");
        return;
      }
      setNome(nomeDigitado.trim());
      setPareamento(result.pareamento);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
      >
        + Nova estação
      </button>

      {!pareamento && (
        <Modal
          open={open}
          onClose={() => {
            setOpen(false);
            reset();
          }}
          title="Nova estação de assinatura"
        >
          <form action={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="nome"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Nome do ponto de coleta
              </label>
              <input
                id="nome"
                name="nome"
                type="text"
                required
                placeholder="Ex.: Almoxarifado — Tablet 1"
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <p className="mt-1 text-[11.5px] text-text-muted">
                Só pra identificar esse ponto na lista — ex.: o setor ou onde
                o aparelho fica fixado.
              </p>
            </div>

            {error && (
              <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Criando..." : "Criar e gerar QR"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <PareamentoModal
        open={open && !!pareamento}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        estacaoNome={nome}
        pareamento={pareamento}
      />
    </>
  );
}
