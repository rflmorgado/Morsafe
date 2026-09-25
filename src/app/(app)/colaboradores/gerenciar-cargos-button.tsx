"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { deleteCargo, deleteSetor } from "./actions";
import type { SetorComCargos } from "@/lib/data/setores";

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

type Alvo = { tipo: "cargo" | "setor"; id: string; nome: string };

/**
 * "Novo colaborador" já deixa criar setor/função na hora ("+ Outro"), mas
 * não tinha volta — uma função descontinuada ficava presa na lista pra
 * sempre. Este botão fecha o ciclo: exclui setor ou função, mas só quando
 * não há mais nada pendurado neles. A trava real é a constraint de chave
 * estrangeira no banco (`on delete restrict` em cargos/colaboradores) — se
 * algum colaborador, mesmo desligado, ainda usa a função, a exclusão é
 * bloqueada e a Server Action traduz isso numa mensagem legível. Por isso o
 * botão de excluir setor já vem desabilitado aqui na lista quando o setor
 * ainda tem alguma função — poupa a viagem ao servidor pra descobrir isso.
 */
export function GerenciarCargosButton({
  setores,
}: {
  setores: SetorComCargos[];
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [pending, startTransition] = useTransition();

  function fecharTudo() {
    setOpen(false);
    setErro(null);
    setAlvo(null);
  }

  function handleConfirmarExclusao() {
    if (!alvo) return;
    setErro(null);
    startTransition(async () => {
      const result =
        alvo.tipo === "cargo"
          ? await deleteCargo(alvo.id)
          : await deleteSetor(alvo.id);

      if (result.error) {
        setErro(result.error);
        return;
      }
      setAlvo(null);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border-strong px-3.5 py-2.5 text-[13px] font-semibold text-foreground transition hover:bg-surface-muted"
      >
        Setores e funções
      </button>

      <Modal
        open={open}
        onClose={fecharTudo}
        title={
          alvo
            ? `Excluir ${alvo.tipo === "cargo" ? "função" : "setor"}`
            : "Setores e funções"
        }
      >
        {alvo ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-danger-bg px-3.5 py-3 text-[13px] font-medium text-danger-text">
              Excluir {alvo.tipo === "cargo" ? "a função" : "o setor"}{" "}
              <span className="font-semibold">{alvo.nome}</span>? Isso só
              funciona se não houver nenhum colaborador (ativo ou desligado)
              usando {alvo.tipo === "cargo" ? "essa função" : "esse setor"} —
              o sistema bloqueia automaticamente caso contrário.
            </p>

            {erro && (
              <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
                {erro}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setAlvo(null);
                  setErro(null);
                }}
                className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusao}
                disabled={pending}
                className="rounded-lg bg-danger-text px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-text-secondary">
              Só é possível excluir um setor ou função sem nenhum colaborador
              vinculado — assim o histórico de quem já teve essa função nunca
              se perde.
            </p>

            {erro && (
              <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
                {erro}
              </p>
            )}

            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {setores.length === 0 ? (
                <p className="text-sm text-text-muted">
                  Nenhum setor cadastrado ainda.
                </p>
              ) : (
                setores.map((s) => (
                  <div
                    key={s.id}
                    className="overflow-hidden rounded-lg border border-border-subtle"
                  >
                    <div className="flex items-center justify-between gap-2 bg-surface-muted px-3.5 py-2.5">
                      <span className="text-[13px] font-semibold text-foreground">
                        {s.nome}
                      </span>
                      <button
                        type="button"
                        title={
                          s.cargos.length > 0
                            ? "Exclua todas as funções deste setor primeiro"
                            : "Excluir setor"
                        }
                        disabled={s.cargos.length > 0}
                        onClick={() =>
                          setAlvo({ tipo: "setor", id: s.id, nome: s.nome })
                        }
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition hover:bg-danger-bg hover:text-danger-text disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-muted"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    {s.cargos.length === 0 ? (
                      <p className="px-3.5 py-2.5 text-[12.5px] text-text-muted">
                        Nenhuma função nesse setor.
                      </p>
                    ) : (
                      <ul>
                        {s.cargos.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center justify-between gap-2 border-t border-border-subtle px-3.5 py-2 text-[13px] text-foreground"
                          >
                            {c.nome}
                            <button
                              type="button"
                              title="Excluir função"
                              onClick={() =>
                                setAlvo({
                                  tipo: "cargo",
                                  id: c.id,
                                  nome: c.nome,
                                })
                              }
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition hover:bg-danger-bg hover:text-danger-text"
                            >
                              <TrashIcon />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={fecharTudo}
                className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
