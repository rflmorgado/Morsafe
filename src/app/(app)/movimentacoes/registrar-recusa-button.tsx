"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { registrarRecusa } from "./actions";
import type { ColaboradorAtivo, EpiAtivo } from "@/lib/data/movimentacoes";

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function agoraHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function RegistrarRecusaButton({
  colaboradores,
  epis,
}: {
  colaboradores: ColaboradorAtivo[];
  epis: EpiAtivo[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await registrarRecusa({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setFormKey((k) => k + 1);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border-strong px-4 py-2.5 text-[13.5px] font-semibold text-foreground transition hover:bg-surface-muted"
      >
        + Registrar recusa
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Registrar recusa">
        <form key={formKey} action={handleSubmit} className="space-y-4">
          <p className="rounded-lg bg-warning-bg px-3.5 py-2.5 text-[12.5px] text-warning-text">
            Registre sempre que um colaborador se recusar a receber ou usar
            um EPI — esse registro protege a empresa em caso de acidente ou
            fiscalização.
          </p>

          <div>
            <label
              htmlFor="recusa-colaborador"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Colaborador
            </label>
            <select
              id="recusa-colaborador"
              name="colaborador_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="" disabled>
                Selecione…
              </option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="recusa-epi"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              EPI
            </label>
            <select
              id="recusa-epi"
              name="epi_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="" disabled>
                Selecione…
              </option>
              {epis.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                  {e.ca ? ` — C.A. ${e.ca}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="recusa-data"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Data
              </label>
              <input
                id="recusa-data"
                name="data"
                type="date"
                required
                defaultValue={hojeISO()}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label
                htmlFor="recusa-hora"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Hora
              </label>
              <input
                id="recusa-hora"
                name="hora"
                type="time"
                required
                defaultValue={agoraHHMM()}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="recusa-observacoes"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Motivo da recusa
            </label>
            <textarea
              id="recusa-observacoes"
              name="observacoes"
              required
              rows={3}
              placeholder="O que o colaborador disse, e o que foi orientado a ele"
              className="w-full resize-none rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label
              htmlFor="recusa-testemunha"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Testemunha{" "}
              <span className="font-normal text-text-muted">(opcional)</span>
            </label>
            <input
              id="recusa-testemunha"
              name="testemunha"
              type="text"
              placeholder="Nome de quem presenciou"
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
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
              {pending ? "Salvando..." : "Registrar recusa"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
