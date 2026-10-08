"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { alterarPlanoAssinatura } from "./actions";
import {
  PLANO_LABEL,
  PLANO_VALOR_MENSAL,
  PLANOS_ORDENADOS,
  formatValorPlano,
} from "@/lib/data/planos";
import type { PlanoAssinatura } from "@/types/database";

/**
 * Upgrade/downgrade de plano — modal com o mesmo seletor de plano usado em
 * setup-empresa-form.tsx (consistência visual), só que aqui alterando uma
 * assinatura já existente em vez de criar uma nova.
 */
export function AlterarPlanoButton({
  assinaturaId,
  empresaNome,
  planoAtual,
}: {
  assinaturaId: string;
  empresaNome: string;
  planoAtual: PlanoAssinatura;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plano, setPlano] = useState<PlanoAssinatura>(planoAtual);
  const [valorEnterprise, setValorEnterprise] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function abrir() {
    setPlano(planoAtual);
    setValorEnterprise("");
    setErro(null);
    setOpen(true);
  }

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const result = await alterarPlanoAssinatura(
        assinaturaId,
        plano,
        valorEnterprise,
      );
      if (result.error) {
        setErro(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          abrir();
        }}
        aria-label={`Alterar plano de ${empresaNome}`}
        className="rounded-lg border border-border-strong px-3 py-1.5 text-[12.5px] font-semibold text-brand-700 transition hover:bg-brand-50"
      >
        Mudar plano
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Mudar plano — ${empresaNome}`}
      >
        <div className="space-y-4">
          <p className="text-[13px] text-text-secondary">
            Atualiza o valor cobrado no Asaas a partir da próxima cobrança
            gerada (a cobrança deste ciclo, se já existir, mantém o valor
            antigo).
          </p>

          <div>
            <label
              htmlFor="novoPlano"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Novo plano
            </label>
            <select
              id="novoPlano"
              value={plano}
              onChange={(e) => setPlano(e.target.value as PlanoAssinatura)}
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-3 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {PLANOS_ORDENADOS.map((p) => (
                <option key={p} value={p}>
                  {PLANO_LABEL[p]}
                  {p === "enterprise"
                    ? " — sob consulta"
                    : ` — ${formatValorPlano(PLANO_VALOR_MENSAL[p])}/mês`}
                </option>
              ))}
            </select>
          </div>

          {plano === "enterprise" && (
            <div>
              <label
                htmlFor="novoValorEnterprise"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Valor mensal negociado (R$)
              </label>
              <input
                id="novoValorEnterprise"
                type="number"
                min="0"
                step="0.01"
                value={valorEnterprise}
                onChange={(e) => setValorEnterprise(e.target.value)}
                placeholder="Ex: 799.00"
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-3 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          )}

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
              Voltar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={confirmar}
              className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Salvando..." : "Confirmar mudança de plano"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
