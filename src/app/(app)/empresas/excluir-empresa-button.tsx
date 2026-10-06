"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import {
  excluirEmpresaPermanentemente,
  type ExcluirEmpresaState,
} from "./actions";

const LABEL_TABELA: Record<string, string> = {
  verificacoes_documento: "Verificações de documento",
  solicitacoes_assinatura: "Solicitações de assinatura",
  estacoes_assinatura: "Estações de assinatura",
  recusas: "Recusas",
  devolucoes: "Devoluções",
  entregas: "Entregas",
  entradas_estoque: "Entradas de estoque",
  auditorias_nr06: "Auditorias de NR-06",
  log_auditoria: "Histórico de ações",
  pagamentos_empresa: "Pagamentos",
  colaboradores: "Colaboradores",
  epis: "EPIs homologados",
  cargos: "Funções",
  setores: "Setores",
  unidades: "Unidades",
  usuarios: "Usuários (logins)",
};

/**
 * Exclusão DEFINITIVA de uma empresa inteira — ver excluirEmpresaPermanentemente
 * em actions.ts e a terceira exceção documentada na regra 3 do CLAUDE.md.
 * Só fica habilitado com a empresa já desativada (mesma trava da função em
 * si, checada nos dois lados) — enquanto ativa, mostra desabilitado com a
 * explicação, em vez de deixar clicar e só então mostrar o erro.
 */
export function ExcluirEmpresaButton({
  empresaId,
  empresaNome,
  ativo,
}: {
  empresaId: string;
  empresaNome: string;
  ativo: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] =
    useState<ExcluirEmpresaState["resultado"]>(undefined);
  const [pending, startTransition] = useTransition();

  const confere = confirmacao.trim() === empresaNome;

  function handleClose() {
    setOpen(false);
    setConfirmacao("");
    setErro(null);
    setResultado(undefined);
  }

  function handleConfirmar() {
    setErro(null);
    startTransition(async () => {
      const result = await excluirEmpresaPermanentemente(
        empresaId,
        confirmacao,
      );
      if (result.error) {
        setErro(result.error);
        setResultado(result.resultado);
        return;
      }
      // Aviso raro (um ou mais logins não puderam ser removidos do
      // Supabase Auth, mesmo com os cadastros já removidos do MorSafe) —
      // sem sistema de toast no app, um alert simples garante que o
      // super_admin não perca esse aviso antes de sair desta tela.
      if (result.avisoLoginsOrfaos) {
        window.alert(result.avisoLoginsOrfaos);
      }
      // A empresa não existe mais — esta própria tela (/empresas/[id])
      // deixaria de ter o que mostrar, por isso volta pra lista em vez de
      // só dar refresh (diferente de ResetarEmpresaButton, que fica na
      // mesma tela porque a empresa continua existindo).
      router.push("/empresas");
    });
  }

  if (ativo) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled
          title="Desative a empresa primeiro para liberar esta opção"
          className="cursor-not-allowed rounded-lg border border-border-strong px-4 py-2.5 text-[13.5px] font-semibold text-text-muted opacity-50"
        >
          Excluir empresa definitivamente
        </button>
        <span className="text-[11.5px] text-text-muted">
          Desative a empresa primeiro para liberar esta opção.
        </span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90"
      >
        Excluir empresa definitivamente
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Excluir empresa definitivamente"
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-danger-bg px-3.5 py-3 text-[13px] font-medium text-danger-text">
            Isso apaga PARA SEMPRE{" "}
            <span className="font-semibold">{empresaNome}</span>: todos os
            logins, colaboradores, EPIs, estoque, entregas, devoluções,
            recusas, auditorias de NR-06, pagamentos e todo o histórico de
            ações — inclusive registros que poderiam ser necessários numa
            fiscalização ou ação trabalhista futura. Não tem como desfazer e
            não existe backup automático disso. Na dúvida, mantenha a
            empresa só desativada (reversível) em vez de excluir.
          </p>

          <div>
            <label
              htmlFor="excluir-empresa-confirmacao"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Digite{" "}
              <span className="font-semibold text-foreground">
                {empresaNome}
              </span>{" "}
              para confirmar
            </label>
            <input
              id="excluir-empresa-confirmacao"
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
              {pending ? "Excluindo..." : "Excluir para sempre"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
