"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { PareamentoModal } from "./pareamento-modal";
import {
  gerarNovoCodigoPareamento,
  desativarEstacaoAssinatura,
  reativarEstacaoAssinatura,
  excluirEstacaoAssinatura,
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

export function EstacaoRowActions({
  estacaoId,
  estacaoNome,
  ativa,
  pareada,
}: {
  estacaoId: string;
  estacaoNome: string;
  ativa: boolean;
  pareada: boolean;
}) {
  const router = useRouter();
  const [pareamento, setPareamento] = useState<PareamentoInfo | null>(null);
  const [confirmarOpen, setConfirmarOpen] = useState(false);
  // Confirmação separada da de desativar/reativar (acima) — só entra em
  // jogo quando a estação já tem um aparelho pareado, porque só nesse caso
  // gerar um novo código tem efeito colateral imediato: o token atual é
  // zerado na hora (ver comentário em gerarNovoCodigoPareamento) e o
  // aparelho já em uso perde acesso sem aviso nenhum. Numa estação nunca
  // pareada não existe aparelho pra tirar do ar, então segue direto sem
  // perguntar, como já era.
  const [confirmarNovoCodigoOpen, setConfirmarNovoCodigoOpen] = useState(false);
  // Exclusão definitiva — só existe pra estação já desativada (ver botão
  // abaixo) e exige digitar o nome, mesmo padrão de ExcluirEpiButton/
  // ExcluirColaboradorButton/ExcluirUsuarioButton: não tem volta, então a
  // confirmação de um clique só (como desativar/reativar acima) não basta.
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [confirmacaoExcluir, setConfirmacaoExcluir] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nomeConfereExcluir =
    confirmacaoExcluir.trim().toLowerCase() === estacaoNome.trim().toLowerCase();

  function gerarCodigo() {
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

  function handleGerarCodigoClick() {
    setErro(null);
    if (pareada) {
      setConfirmarNovoCodigoOpen(true);
      return;
    }
    gerarCodigo();
  }

  function handleConfirmarNovoCodigo() {
    setConfirmarNovoCodigoOpen(false);
    gerarCodigo();
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

  function handleCloseExcluir() {
    setExcluirOpen(false);
    setConfirmacaoExcluir("");
    setErro(null);
  }

  function handleConfirmarExclusao() {
    setErro(null);
    startTransition(async () => {
      const result = await excluirEstacaoAssinatura(estacaoId);
      if (result.error) {
        setErro(result.error);
        return;
      }
      handleCloseExcluir();
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
          onClick={handleGerarCodigoClick}
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
        {!ativa && (
          <button
            type="button"
            title="Excluir definitivamente"
            aria-label={`Excluir ${estacaoNome} definitivamente`}
            onClick={() => setExcluirOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-danger-bg hover:text-danger-text"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      <PareamentoModal
        open={!!pareamento}
        onClose={() => setPareamento(null)}
        estacaoNome={estacaoNome}
        pareamento={pareamento}
      />

      <Modal
        open={confirmarNovoCodigoOpen}
        onClose={() => {
          setConfirmarNovoCodigoOpen(false);
          setErro(null);
        }}
        title="Gerar novo código de pareamento"
      >
        <div className="space-y-4">
          <p className="text-[13.5px] text-text-secondary">
            <span className="font-semibold text-foreground">
              {estacaoNome}
            </span>{" "}
            já tem um aparelho pareado. Gerar um novo código tira esse
            aparelho do ar imediatamente — ele só volta a funcionar depois
            que o código novo for escaneado nele (ou em outro). Use isso pra
            trocar de aparelho (tablet quebrou, foi substituído etc.).
          </p>

          {erro && (
            <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirmarNovoCodigoOpen(false)}
              className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarNovoCodigo}
              disabled={pending}
              className="rounded-lg bg-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Gerando..." : "Gerar mesmo assim"}
            </button>
          </div>
        </div>
      </Modal>

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

      <Modal
        open={excluirOpen}
        onClose={handleCloseExcluir}
        title="Excluir estação definitivamente"
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-danger-bg px-3.5 py-3 text-[13px] font-medium text-danger-text">
            Isso vai apagar <span className="font-semibold">{estacaoNome}</span>{" "}
            permanentemente, junto com o histórico de pedidos de assinatura
            registrados nela. Não é o mesmo que desativar — não tem como
            desfazer. Assinaturas já confirmadas continuam preservadas nas
            entregas correspondentes, isso não afeta a conformidade com a
            NR-06.
          </p>

          <div>
            <label
              htmlFor="excluir-estacao-confirmacao"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Digite <span className="font-semibold text-foreground">{estacaoNome}</span>{" "}
              para confirmar
            </label>
            <input
              id="excluir-estacao-confirmacao"
              type="text"
              value={confirmacaoExcluir}
              onChange={(e) => setConfirmacaoExcluir(e.target.value)}
              placeholder={estacaoNome}
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
              onClick={handleCloseExcluir}
              className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarExclusao}
              disabled={pending || !nomeConfereExcluir}
              className="rounded-lg bg-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Excluindo..." : "Excluir definitivamente"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
