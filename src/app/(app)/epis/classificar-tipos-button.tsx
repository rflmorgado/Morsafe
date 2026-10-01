"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { classificarTiposFaltantes } from "./actions";

type Resultado = {
  atualizados: number;
  semClassificacao: number;
};

/**
 * Botão de manutenção: preenche o Tipo de todo EPI ativo que está sem tipo,
 * usando classificarTipoEpi() (palavra-chave no nome, ver epi-tipos.ts) —
 * pensado pro catálogo que já tinha itens sem tipo ANTES desse fallback
 * automático existir nas importações/cadastro (ver criarEpiCatalogo/
 * importarEpis/createEpi em actions.ts, que agora preenchem isso sozinhos
 * em todo EPI novo). Fica no mesmo lugar de ImportarEpisButton porque não é
 * de uso único de verdade: qualquer EPI antigo sem tipo (de antes dessa
 * mudança) só é corrigido rodando isso de novo.
 *
 * Nunca sobrescreve um tipo já preenchido — só completa o que estava em
 * branco. Classificação por palavra-chave erra em nomes fora do padrão; por
 * isso o resultado sempre mostra quantos ficaram sem reconhecer nada, pra
 * esses serem ajustados manualmente (editar EPI → Tipo).
 */
export function ClassificarTiposButton() {
  const [open, setOpen] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClose() {
    setOpen(false);
    setResultado(null);
    setError(null);
  }

  function handleClassificar() {
    setError(null);
    startTransition(async () => {
      const result = await classificarTiposFaltantes();
      if (result.error) {
        setError(result.error);
        return;
      }
      setResultado({
        atualizados: result.atualizados ?? 0,
        semClassificacao: result.semClassificacao ?? 0,
      });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border-strong px-4 py-2.5 text-[13.5px] font-semibold text-foreground transition hover:bg-surface-muted"
      >
        ✨ Classificar tipos
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Classificar tipos automaticamente"
      >
        {resultado !== null ? (
          <div className="space-y-4">
            <div className="space-y-1.5 rounded-lg bg-brand-50 px-3.5 py-3 text-[13.5px] font-medium text-brand-700">
              {resultado.atualizados > 0 ? (
                <p>
                  ✓ {resultado.atualizados}{" "}
                  {resultado.atualizados === 1
                    ? "EPI classificado"
                    : "EPIs classificados"}{" "}
                  automaticamente.
                </p>
              ) : (
                <p>Nenhum EPI sem tipo encontrado para classificar.</p>
              )}
              {resultado.semClassificacao > 0 && (
                <p className="text-text-secondary">
                  {resultado.semClassificacao}{" "}
                  {resultado.semClassificacao === 1
                    ? "item ficou sem tipo"
                    : "itens ficaram sem tipo"}{" "}
                  (nome não reconhecido) — ajuste manualmente em
                  &ldquo;Editar&rdquo;.
                </p>
              )}
            </div>

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
          <div className="space-y-4">
            <p className="text-[13.5px] text-text-secondary">
              Preenche sozinho o Tipo de todo EPI ativo que está sem tipo,
              pelo nome (ex.: &ldquo;Luvas...&rdquo; vira &ldquo;Proteção das
              mãos&rdquo;). Um EPI que já tem tipo nunca é alterado.
            </p>
            <p className="rounded-lg bg-surface-muted px-3.5 py-2.5 text-[12.5px] text-text-secondary">
              É uma classificação por palavra-chave, não substitui sua
              revisão: nomes fora do padrão podem não ser reconhecidos e
              ficam sem tipo, pra você ajustar manualmente depois.
            </p>

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
                type="button"
                disabled={pending}
                onClick={handleClassificar}
                className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Classificando..." : "Classificar automaticamente"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
