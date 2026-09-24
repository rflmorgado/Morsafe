"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { SignaturePad } from "@/components/ui/signature-pad";
import { registrarEntrega } from "./actions";
import { MOTIVO_ENTREGA_LABEL } from "@/lib/data/movimentacoes-labels";
import type { ColaboradorAtivo, EpiAtivo } from "@/lib/data/movimentacoes";
import type { MotivoEntrega } from "@/types/database";

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function agoraHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const MOTIVOS = Object.entries(MOTIVO_ENTREGA_LABEL) as [MotivoEntrega, string][];

export function RegistrarEntregaButton({
  colaboradores,
  epis,
}: {
  colaboradores: ColaboradorAtivo[];
  epis: EpiAtivo[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Força o SignaturePad a remontar (e limpar) a cada abertura do modal.
  const [formKey, setFormKey] = useState(0);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await registrarEntrega({ error: null }, formData);
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
        className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
      >
        + Registrar entrega
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Registrar entrega">
        <form key={formKey} action={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="entrega-colaborador"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Colaborador
            </label>
            <select
              id="entrega-colaborador"
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
              htmlFor="entrega-epi"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              EPI
            </label>
            <select
              id="entrega-epi"
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

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <label
                htmlFor="entrega-motivo"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Motivo
              </label>
              <select
                id="entrega-motivo"
                name="motivo"
                required
                defaultValue=""
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <option value="" disabled>
                  Selecione…
                </option>
                {MOTIVOS.map(([valor, label]) => (
                  <option key={valor} value={valor}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="entrega-quantidade"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Quantidade
              </label>
              <input
                id="entrega-quantidade"
                name="quantidade"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={1}
                className="w-20 rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="entrega-data"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Data
              </label>
              <input
                id="entrega-data"
                name="data"
                type="date"
                required
                defaultValue={hojeISO()}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label
                htmlFor="entrega-hora"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Hora
              </label>
              <input
                id="entrega-hora"
                name="hora"
                type="time"
                required
                defaultValue={agoraHHMM()}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
              Confirmação de recebimento
            </label>
            <SignaturePad name="assinatura_url" />
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
              {pending ? "Salvando..." : "Registrar entrega"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
