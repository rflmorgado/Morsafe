"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { createColaborador } from "./actions";
import type { SetorComCargos } from "@/lib/data/setores";

export function NovoColaboradorButton({
  setores,
}: {
  setores: SetorComCargos[];
}) {
  const [open, setOpen] = useState(false);
  const [setorId, setSetorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cargosDoSetor = setores.find((s) => s.id === setorId)?.cargos ?? [];

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createColaborador({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setSetorId("");
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

          <div className="grid grid-cols-2 gap-3">
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
                onChange={(e) => setSetorId(e.target.value)}
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
              </select>
            </div>

            <div>
              <label
                htmlFor="cargo_id"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Cargo
              </label>
              <select
                id="cargo_id"
                name="cargo_id"
                required
                disabled={!setorId}
                defaultValue=""
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
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          {error && (
            <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
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
