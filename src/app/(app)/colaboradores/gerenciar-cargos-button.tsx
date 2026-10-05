"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { deleteCargo, deleteSetor, mesclarSetores } from "./actions";
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

// Dois ramos convergindo num só (mesma leitura visual usada em "git merge")
// — "junte este setor com outro", pra diferenciar de excluir (TrashIcon).
function MergeIcon() {
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
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M6 8.2V18" />
      <path d="M6 12c0 3.3 2.7 4 6 4h4" />
    </svg>
  );
}

type Alvo = { tipo: "cargo" | "setor"; id: string; nome: string };
type SetorRef = { id: string; nome: string };

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
 *
 * Também dá pra MESCLAR um setor dentro de outro (ícone ao lado do de
 * excluir) — ao contrário de excluir, funciona mesmo com colaboradores e
 * funções cadastrados: tudo é movido pro setor escolhido antes do setor de
 * origem sumir (ver `mesclarSetores` em actions.ts para o passo a passo
 * completo). Adicionado 05/10/2026 pra corrigir setores que ficaram
 * duplicados (ex: "PCP" cadastrado duas vezes) por um bug já corrigido em
 * `createSetor`.
 */
export function GerenciarCargosButton({
  setores,
}: {
  setores: SetorComCargos[];
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [mesclarOrigem, setMesclarOrigem] = useState<SetorRef | null>(null);
  const [mesclarDestino, setMesclarDestino] = useState<SetorRef | null>(null);
  const [pending, startTransition] = useTransition();

  function fecharTudo() {
    setOpen(false);
    setErro(null);
    setAlvo(null);
    setMesclarOrigem(null);
    setMesclarDestino(null);
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

  function handleConfirmarMesclagem() {
    if (!mesclarOrigem || !mesclarDestino) return;
    setErro(null);
    startTransition(async () => {
      const result = await mesclarSetores(mesclarOrigem.id, mesclarDestino.id);

      if (result.error) {
        setErro(result.error);
        return;
      }
      setMesclarOrigem(null);
      setMesclarDestino(null);
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
            : mesclarDestino
              ? `Mesclar "${mesclarOrigem?.nome}" com "${mesclarDestino.nome}"`
              : mesclarOrigem
                ? `Mesclar "${mesclarOrigem.nome}" com qual setor?`
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
        ) : mesclarDestino && mesclarOrigem ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-danger-bg px-3.5 py-3 text-[13px] font-medium text-danger-text">
              Mesclar <span className="font-semibold">{mesclarOrigem.nome}</span>{" "}
              dentro de <span className="font-semibold">{mesclarDestino.nome}</span>?
              Todos os colaboradores, funções e EPIs obrigatórios de{" "}
              {mesclarOrigem.nome} passam a ficar em {mesclarDestino.nome}, e o
              setor {mesclarOrigem.nome} é excluído. Não tem como desfazer com
              um clique.
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
                  setMesclarDestino(null);
                  setErro(null);
                }}
                className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmarMesclagem}
                disabled={pending}
                className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Mesclando..." : "Mesclar"}
              </button>
            </div>
          </div>
        ) : mesclarOrigem ? (
          <div className="space-y-4">
            <p className="text-[13px] text-text-secondary">
              Escolha o setor que vai RECEBER tudo de{" "}
              <span className="font-semibold text-foreground">
                {mesclarOrigem.nome}
              </span>
              . {mesclarOrigem.nome} será excluído no final.
            </p>

            <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {setores
                .filter((s) => s.id !== mesclarOrigem.id)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setMesclarDestino({ id: s.id, nome: s.nome })}
                    className="w-full rounded-lg border border-border-subtle px-3.5 py-2.5 text-left text-[13px] font-semibold text-foreground transition hover:border-brand-700 hover:bg-brand-50"
                  >
                    {s.nome}
                  </button>
                ))}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setMesclarOrigem(null)}
                className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
              >
                Voltar
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
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title={
                            setores.length < 2
                              ? "Precisa de outro setor pra mesclar"
                              : "Mesclar com outro setor"
                          }
                          disabled={setores.length < 2}
                          onClick={() =>
                            setMesclarOrigem({ id: s.id, nome: s.nome })
                          }
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition hover:bg-brand-100 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-muted"
                        >
                          <MergeIcon />
                        </button>
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
