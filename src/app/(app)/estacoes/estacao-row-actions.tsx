"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { PareamentoModal } from "./pareamento-modal";
import {
  gerarNovoCodigoPareamento,
  desativarEstacaoAssinatura,
  reativarEstacaoAssinatura,
  type PareamentoInfo,
} from "./actions";

function QrIcon() {
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
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" />
      <path d="M20 14v.01" />
      <path d="M14 20v.01" />
      <path d="M17 17v3" />
      <path d="M20 20v.01" />
    </svg>
  );
}

function PowerIcon() {
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
      <path d="M12 2v10" />
      <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    </svg>
  );
}

export function EstacaoRowActions({
  estacaoId,
  estacaoNome,
  ativa,
}: {
  estacaoId: string;
  estacaoNome: string;
  ativa: boolean;
}) {
  const router = useRouter();
  const [pareamento, setPareamento] = useState<PareamentoInfo | null>(null);
  const [confirmarOpen, setConfirmarOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGerarCodigo() {
    setErro(null);
    startTransition(async () => {
      const result = await gerarNovoCodigoPareamento(estacaoId);
      if (result.error || !result.pareamento) {
        setErro(result.error ?? "Não foi possível gerar o código.");
        return;
      }
      setPareamento(result.pareamento);
    });
  }

  function handleConfirmarStatus() {
    setErro(null);
    startTransition(async () => {
      const result = ativa
        ? await desativarEstacaoAssinatura(estacaoId)
        : await reativarEstacaoAssinatura(estacaoId);
      if (result.error) {
        setErro(result.error);
        return;
      }
      setConfirmarOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          title="Gerar novo código de pareamento (troca de aparelho)"
          aria-label={`Gerar novo código de pareamento para ${estacaoNome}`}
          onClick={handleGerarCodigo}
          disabled={pending}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <QrIcon />
        </button>
        <button
          type="button"
          title={ativa ? "Desativar estação" : "Reativar estação"}
          aria-label={`${ativa ? "Desativar" : "Reativar"} ${estacaoNome}`}
          onClick={() => setConfirmarOpen(true)}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
            ativa
              ? "text-text-muted hover:bg-danger-bg hover:text-danger-text"
              : "text-text-muted hover:bg-brand-100 hover:text-brand-700"
          }`}
        >
          <PowerIcon />
        </button>
      </div>

      <PareamentoModal
        open={!!pareamento}
        onClose={() => setPareamento(null)}
        estacaoNome={estacaoNome}
        pareamento={pareamento}
      />

      <Modal
        open={confirmarOpen}
        onClose={() => {
          setConfirmarOpen(false);
          setErro(null);
        }}
        title={ativa ? "Desativar estação" : "Reativar estação"}
      >
        <div className="space-y-4">
          <p className="text-[13.5px] text-text-secondary">
            {ativa ? (
              <>
                Você está prestes a desativar{" "}
                <span className="font-semibold text-foreground">
                  {estacaoNome}
                </span>
                . O aparelho pareado perde o acesso na hora e ela some da
                lista de estações disponíveis ao registrar entregas.
              </>
            ) : (
              <>
                Você está prestes a reativar{" "}
                <span className="font-semibold text-foreground">
                  {estacaoNome}
                </span>
                . Ela volta a aparecer como opção ao registrar entregas.
              </>
            )}
          </p>

          {erro && (
            <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirmarOpen(false)}
              className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarStatus}
              disabled={pending}
              className={`rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                ativa
                  ? "bg-danger-text hover:opacity-90"
                  : "bg-brand-700 hover:bg-brand-800"
              }`}
            >
              {pending
                ? "Salvando..."
                : ativa
                  ? "Confirmar desativação"
                  : "Confirmar reativação"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
