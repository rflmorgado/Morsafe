"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { createColaborador, createSetor, createCargo } from "./actions";
import type { SetorComCargos } from "@/lib/data/setores";

const OUTRO = "__outro__";

export function NovoColaboradorButton({
  setores,
}: {
  setores: SetorComCargos[];
}) {
  const [open, setOpen] = useState(false);
  const [setorId, setSetorId] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cargosDoSetor = setores.find((s) => s.id === setorId)?.cargos ?? [];
  const setorNovo = setorId === OUTRO;
  const cargoNovo = setorNovo || cargoId === OUTRO;

  function reset() {
    setSetorId("");
    setCargoId("");
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      let finalSetorId = setorId;

      if (setorNovo) {
        const nomeSetor = String(formData.get("setor_nome_novo") ?? "").trim();
        if (!nomeSetor) {
          setError("Digite o nome do novo setor.");
          return;
        }
        const setorResult = await createSetor(nomeSetor);
        if (setorResult.error || !setorResult.id) {
          setError(setorResult.error ?? "Não foi possível criar o setor.");
          return;
        }
        finalSetorId = setorResult.id;
      }

      let finalCargoId = cargoId;

      if (cargoNovo) {
        const nomeCargo = String(formData.get("cargo_nome_novo") ?? "").trim();
        if (!nomeCargo) {
          setError("Digite o nome da nova função.");
          return;
        }
        const cargoResult = await createCargo(finalSetorId, nomeCargo);
        if (cargoResult.error || !cargoResult.id) {
          setError(cargoResult.error ?? "Não foi possível criar a função.");
          return;
        }
        finalCargoId = cargoResult.id;
      }

      formData.set("setor_id", finalSetorId);
      formData.set("cargo_id", finalCargoId);

      const result = await createColaborador({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
      >
        + Novo colaborador
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo colaborador"
      >
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="nome"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Nome completo
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              required
              placeholder="Nome do colaborador"
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="setor_id"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Setor
              </label>
              <select
                id="setor_id"
                name="setor_id"
                required
                value={setorId}
                onChange={(e) => {
                  setSetorId(e.target.value);
                  setCargoId("");
                }}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <option value="" disabled>
                  Selecione…
                </option>
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
                <option value={OUTRO}>+ Outro (digitar)</option>
              </select>
              {setorNovo && (
                <input
                  name="setor_nome_novo"
                  type="text"
                  required
                  placeholder="Nome do novo setor"
                  className="mt-2 w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              )}
            </div>

            <div>
              <label
                htmlFor="cargo_id"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Cargo
              </label>
              {setorNovo ? (
                <input
                  name="cargo_nome_novo"
                  type="text"
                  required
                  placeholder="Nome da função"
                  className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              ) : (
                <>
                  <select
                    id="cargo_id"
                    name="cargo_id"
                    required
                    disabled={!setorId}
                    value={cargoId}
                    onChange={(e) => setCargoId(e.target.value)}
                    className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="" disabled>
                      {setorId ? "Selecione…" : "Escolha um setor"}
                    </option>
                    {cargosDoSetor.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                    {setorId && <option value={OUTRO}>+ Outro (digitar)</option>}
                  </select>
                  {cargoNovo && (
                    <input
                      name="cargo_nome_novo"
                      type="text"
                      required
                      placeholder="Nome da nova função"
                      className="mt-2 w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="cpf"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                CPF <span className="font-normal text-text-muted">(opcional)</span>
              </label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                placeholder="000.000.000-00"
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label
                htmlFor="telefone"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Telefone <span className="font-normal text-text-muted">(opcional)</span>
              </label>
              <input
                id="telefone"
                name="telefone"
                type="text"
                placeholder="(00) 00000-0000"
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="data_integracao_seguranca"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Integração de Segurança / Treinamento NR-06{" "}
              <span className="font-normal text-text-muted">(opcional)</span>
            </label>
            <input
              id="data_integracao_seguranca"
              name="data_integracao_seguranca"
              type="date"
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <p className="mt-1 text-[11.5px] text-text-muted">
              Data da Integração de Segurança (admissão) ou da última
              reciclagem/treinamento anual de NR-06 — se sua empresa recicla
              todo ano, atualize esta data a cada reciclagem.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Salvar colaborador"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
