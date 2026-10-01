"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { resetarDadosEmpresa, type ResetEmpresaState } from "./actions";

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

/**
 * Versão permanente, por empresa, da ferramenta temporária que existiu em
 * ferramenta-reset-viniplast (removida nesta mesma entrega). Pede o nome
 * exato da empresa como confirmação — não uma frase fixa — porque esta
 * tela lista várias empresas e um clique errado na linha errada não pode
 * acabar apagando os dados de quem não devia.
 */
export function ResetarEmpresaButton({
  empresaId,
  empresaNome,
}: {
  empresaId: string;
  empresaNome: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] =
    useState<ResetEmpresaState["resultado"]>(undefined);
  const [concluido, setConcluido] = useState(false);
  const [pending, startTransition] = useTransition();

  const confere = confirmacao.trim() === empresaNome;

  function handleClose() {
    setOpen(false);
    setConfirmacao("");
    setErro(null);
    setResultado(undefined);
    setConcluido(false);
  }

  function handleConfirmar() {
    setErro(null);
    startTransition(async () => {
      const result = await resetarDadosEmpresa(empresaId, confirmacao);
      if (result.error) {
        setErro(result.error);
        setResultado(result.resultado);
        return;
      }
      setResultado(result.resultado);
      setConcluido(true);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-danger-text transition hover:bg-danger-bg"
      >
        Resetar dados de teste
      </button>

      <Modal open={open} onClose={handleClose} title="Resetar dados de teste">
        {concluido ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[13.5px] font-medium text-brand-700">
              ✓ Reset concluído. {empresaNome} está pronta para receber os
              dados corretos.
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
            <p className="rounded-lg bg-danger-bg px-3.5 py-3 text-[13px] font-medium text-danger-text">
              Isso apaga permanentemente Colaboradores, EPIs homologados,
              Estoque, Entradas de estoque, Entregas, Devoluções, Recusas,
              verificações de documento e solicitações de assinatura de{" "}
              <span className="font-semibold">{empresaNome}</span>. Não tem
              como desfazer. A empresa, os logins e a estrutura (unidades/
              setores/cargos) não são afetados.
            </p>

            <div>
              <label
                htmlFor="reset-empresa-confirmacao"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Digite{" "}
                <span className="font-semibold text-foreground">
                  {empresaNome}
                </span>{" "}
                para confirmar
              </label>
              <input
                id="reset-empresa-confirmacao"
                type="text"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder={empresaNome}
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
                disabled={pending || !confere}
                onClick={handleConfirmar}
                className="rounded-lg bg-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Apagando..." : "Resetar dados"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
