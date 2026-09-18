"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { updateColaborador } from "./actions";
import type { SetorComCargos } from "@/lib/data/setores";

function EditIcon() {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="M15 5l4 4" />
    </svg>
  );
}

export function EditarColaboradorButton({
  colaborador,
  setores,
}: {
  colaborador: {
    id: string;
    nome: string;
    setorId: string | null;
    cargoId: string | null;
    cpf: string | null;
    telefone: string | null;
  };
  setores: SetorComCargos[];
}) {
  const [open, setOpen] = useState(false);
  const [setorId, setSetorId] = useState(colaborador.setorId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cargosDoSetor = setores.find((s) => s.id === setorId)?.cargos ?? [];

  function handleClose() {
    setOpen(false);
    setError(null);
    setSetorId(colaborador.setorId ?? "");
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateColaborador({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        title="Editar colaborador"
        aria-label={`Editar ${colaborador.nome}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-brand-50 hover:text-brand-700"
      >
        <EditIcon />
      </button>

      <Modal open={open} onClose={handleClose} title="Editar colaborador">
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={colaborador.id} />

          <div>
            <label
              htmlFor="edit-nome"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Nome completo
            </label>
            <input
              id="edit-nome"
              name="nome"
              type="text"
              required
              defaultValue={colaborador.nome}
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-setor_id"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Setor
              </label>
              <select
                id="edit-setor_id"
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
                htmlFor="edit-cargo_id"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Cargo
              </label>
              <select
                id="edit-cargo_id"
                name="cargo_id"
                required
                disabled={!setorId}
                defaultValue={colaborador.cargoId ?? ""}
                key={setorId}
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
                htmlFor="edit-cpf"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                CPF <span className="font-normal text-text-muted">(opcional)</span>
              </label>
              <input
                id="edit-cpf"
                name="cpf"
                type="text"
                defaultValue={colaborador.cpf ?? ""}
                placeholder="000.000.000-00"
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label
                htmlFor="edit-telefone"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Telefone <span className="font-normal text-text-muted">(opcional)</span>
              </label>
              <input
                id="edit-telefone"
                name="telefone"
                type="text"
                defaultValue={colaborador.telefone ?? ""}
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
              onClick={handleClose}
              className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
