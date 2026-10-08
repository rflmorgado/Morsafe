"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { cancelarAssinatura } from "./actions";

/**
 * Cancela a assinatura recorrente de uma empresa — pede confirmação num
 * modal (mesmo padrão de AlternarAtivoButton em empresas/ativar-empresa-
 * button.tsx) porque tem efeito real de dinheiro (para a cobrança no
 * Asaas), ainda que não apague nenhum dado.
 */
export function CancelarAssinaturaButton({
  assinaturaId,
  empresaNome,
}: {
  assinaturaId: string;
  empresaNome: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function executar() {
    setErro(null);
    startTransition(async () => {
      const result = await cancelarAssinatura(assinaturaId);
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
        // stopPropagation: a linha/cartão leva ao detalhe da empresa (ver
        // assinaturas/page.tsx, mesmo padrão de pagamentos/page.tsx).
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Cancelar assinatura de ${empresaNome}`}
        className="rounded-lg border border-border-strong px-3 py-1.5 text-[12.5px] font-semibold text-danger-text transition hover:bg-danger-bg"
      >
        Cancelar
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cancelar assinatura"
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-danger-bg px-3.5 py-3 text-[13px] font-medium text-danger-text">
            Isso cancela a cobrança recorrente de{" "}
            <span className="font-semibold">{empresaNome}</span> no Asaas —
            nenhuma cobrança nova será gerada a partir de agora. O histórico
            de pagamentos já feitos continua intacto. Não tem como desfazer
            por aqui (precisaria criar uma assinatura nova no Asaas).
          </p>

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
              onClick={executar}
              className="rounded-lg bg-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Cancelando..." : "Cancelar assinatura"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
