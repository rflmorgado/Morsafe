"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarPagamentoComoPago } from "./actions";

/**
 * Marca um pagamento pendente como recebido. De um clique só (sem modal de
 * confirmação) — diferente de Resetar/Desativar empresa, essa ação não
 * apaga nem bloqueia nada, só sinaliza que o dinheiro entrou, então o custo
 * de um clique errado é baixo (e dá pra corrigir lançando um pagamento novo
 * se precisar).
 */
export function MarcarPagoButton({
  pagamentoId,
  empresaNome,
}: {
  pagamentoId: string;
  empresaNome: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await marcarPagamentoComoPago(pagamentoId);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      aria-label={`Marcar pagamento de ${empresaNome} como pago`}
      className="rounded-lg border border-border-strong px-3 py-1.5 text-[12.5px] font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Marcando..." : "Marcar como pago"}
    </button>
  );
}
