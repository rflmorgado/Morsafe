"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "@/components/ui/modal";
import type { PareamentoInfo } from "./actions";

/**
 * Conteúdo mostrado depois que criarEstacaoAssinatura/gerarNovoCodigoPareamento
 * retorna um código — o QR é gerado no navegador (não no servidor) porque só
 * o navegador sabe o domínio de verdade (window.location.origin), sem
 * precisar de nenhuma variável de ambiente extra só pra isso.
 */
export function PareamentoModal({
  open,
  onClose,
  estacaoNome,
  pareamento,
}: {
  open: boolean;
  onClose: () => void;
  estacaoNome: string;
  pareamento: PareamentoInfo | null;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  // Só o navegador sabe o domínio de verdade — por isso o link só existe
  // depois de montado no cliente. Não precisa de estado: é só derivar do
  // próprio `pareamento` recebido por prop.
  const url =
    pareamento && typeof window !== "undefined"
      ? `${window.location.origin}/estacao/parear?codigo=${pareamento.codigo}`
      : "";

  useEffect(() => {
    if (!pareamento) return;
    const destino = `${window.location.origin}/estacao/parear?codigo=${pareamento.codigo}`;
    QRCode.toDataURL(destino, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch((e) => console.error("QRCode.toDataURL:", e));
  }, [pareamento]);

  if (!pareamento) return null;

  const expira = new Date(pareamento.expiraEm).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Modal open={open} onClose={onClose} title={`Parear "${estacaoNome}"`}>
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-[13px] text-text-secondary">
          No tablet/celular <strong>da empresa</strong> que vai ficar fixo
          nesse ponto de coleta, abra a câmera e aponte pra este código.
          Depois de parear, dá pra deixar o navegador aberto e adicionar essa
          página à tela inicial do aparelho.
        </p>

        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR code de pareamento"
            width={220}
            height={220}
            className="rounded-lg border border-border-subtle"
          />
        ) : (
          <div className="flex h-[220px] w-[220px] items-center justify-center rounded-lg border border-border-subtle text-[12px] text-text-muted">
            Gerando QR…
          </div>
        )}

        <div className="w-full rounded-lg bg-surface-muted px-3.5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Ou digite o código manualmente
          </p>
          <p className="mt-0.5 font-mono text-[18px] font-bold tracking-widest text-foreground">
            {pareamento.codigo}
          </p>
        </div>

        <p className="text-[11.5px] text-text-muted">
          Válido até {expira}. Se expirar antes de parear, gere um código
          novo pra essa estação.
        </p>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-[11.5px] font-semibold text-brand-700 hover:underline"
        >
          Abrir o link diretamente (se já estiver no próprio aparelho)
        </a>

        <button
          type="button"
          onClick={onClose}
          className="mt-1 w-full rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
        >
          Concluir
        </button>
      </div>
    </Modal>
  );
}
