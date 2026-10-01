"use client";

import { useState, useTransition } from "react";
import { resetarDadosViniplast, type ResetEmpresaState } from "./actions";

// Mesma string checada no servidor (actions.ts) — duplicada aqui de
// propósito: um arquivo "use server" só pode exportar funções async.
const CONFIRMACAO_ESPERADA = "RESETAR VINIPLAST";

const LABEL_TABELA: Record<string, string> = {
  verificacoes_documento: "Verificações de documento",
  solicitacoes_assinatura: "Solicitações de assinatura",
  recusas: "Recusas",
  devolucoes: "Devoluções",
  entregas: "Entregas",
  entradas_estoque: "Entradas de estoque",
  colaboradores: "Colaboradores",
  epis: "EPIs homologados",
};

export function ResetEmpresaForm() {
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] =
    useState<ResetEmpresaState["resultado"]>(undefined);
  const [concluido, setConcluido] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmacaoConfere = confirmacao.trim() === CONFIRMACAO_ESPERADA;

  function handleConfirmar() {
    setErro(null);
    startTransition(async () => {
      const result = await resetarDadosViniplast(confirmacao);
      if (result.error) {
        setErro(result.error);
        setResultado(result.resultado);
        return;
      }
      setResultado(result.resultado);
      setConcluido(true);
    });
  }

  if (concluido) {
    return (
      <div className="space-y-4 rounded-xl border border-border-subtle bg-surface p-6">
        <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[13.5px] font-medium text-brand-700">
          ✓ Reset concluído. A ViniPlast está pronta para receber os dados
          corretos — comece pela importação dos EPIs homologados.
        </p>
        {resultado && (
          <ul className="space-y-1 text-[13px] text-text-secondary">
            {Object.entries(resultado).map(([tabela, count]) => (
              <li key={tabela} className="flex justify-between">
                <span>{LABEL_TABELA[tabela] ?? tabela}</span>
                <span className="font-medium text-foreground">
                  {count} apagada{count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border-subtle bg-surface p-6">
      <p className="rounded-lg bg-danger-bg px-3.5 py-3 text-[13px] font-medium text-danger-text">
        Isso apaga permanentemente os Colaboradores, EPIs homologados,
        Estoque, Entradas de estoque, Entregas, Devoluções, Recusas,
        verificações de documento e solicitações de assinatura da
        ViniPlast. Não tem como desfazer. A empresa, os logins e a
        estrutura (unidades/setores/cargos) não são afetados.
      </p>

      <div>
        <label
          htmlFor="reset-confirmacao"
          className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
        >
          Digite{" "}
          <span className="font-semibold text-foreground">
            {CONFIRMACAO_ESPERADA}
          </span>{" "}
          para confirmar
        </label>
        <input
          id="reset-confirmacao"
          type="text"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          placeholder={CONFIRMACAO_ESPERADA}
          className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {erro && (
        <div className="space-y-2">
          <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
            {erro}
          </p>
          {resultado && Object.keys(resultado).length > 0 && (
            <ul className="space-y-1 text-[12.5px] text-text-secondary">
              {Object.entries(resultado).map(([tabela, count]) => (
                <li key={tabela} className="flex justify-between">
                  <span>{LABEL_TABELA[tabela] ?? tabela}</span>
                  <span className="font-medium text-foreground">
                    {count} apagada{count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleConfirmar}
          disabled={pending || !confirmacaoConfere}
          className="rounded-lg bg-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Apagando..." : "Resetar dados da ViniPlast"}
        </button>
      </div>
    </div>
  );
}
