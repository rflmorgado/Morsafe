"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { registrarDevolucao, buscarEntregasEmPosse } from "./actions";
import {
  MOTIVO_DEVOLUCAO_LABEL,
  DESTINO_DEVOLUCAO_LABEL,
} from "@/lib/data/movimentacoes-labels";
import type {
  ColaboradorAtivo,
  EntregaEmPosse,
} from "@/lib/data/movimentacoes";
import type { MotivoDevolucao, DestinoDevolucao } from "@/types/database";

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

const MOTIVOS = Object.entries(MOTIVO_DEVOLUCAO_LABEL) as [
  MotivoDevolucao,
  string,
][];
const DESTINOS = Object.entries(DESTINO_DEVOLUCAO_LABEL) as [
  DestinoDevolucao,
  string,
][];

const EXTRAVIADO: MotivoDevolucao = "extraviado_nao_devolvido";

export function RegistrarDevolucaoButton({
  colaboradores,
}: {
  colaboradores: ColaboradorAtivo[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  const [colaboradorId, setColaboradorId] = useState("");
  const [entregasEmPosse, setEntregasEmPosse] = useState<EntregaEmPosse[]>([]);
  const [carregandoEntregas, setCarregandoEntregas] = useState(false);
  const [entregaSelecionada, setEntregaSelecionada] = useState<
    EntregaEmPosse | null
  >(null);
  const [motivo, setMotivo] = useState<MotivoDevolucao | "">("");

  const extraviado = motivo === EXTRAVIADO;

  function reset() {
    setColaboradorId("");
    setEntregasEmPosse([]);
    setEntregaSelecionada(null);
    setMotivo("");
    setError(null);
  }

  async function handleColaboradorChange(id: string) {
    setColaboradorId(id);
    setEntregaSelecionada(null);
    setEntregasEmPosse([]);
    if (!id) return;
    setCarregandoEntregas(true);
    try {
      const entregas = await buscarEntregasEmPosse(id);
      setEntregasEmPosse(entregas);
    } finally {
      setCarregandoEntregas(false);
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (!entregaSelecionada) {
      setError("Selecione qual EPI está sendo devolvido.");
      return;
    }
    formData.set("epi_id", entregaSelecionada.epiId);
    formData.set("entrega_vinculada_id", entregaSelecionada.id);
    startTransition(async () => {
      const result = await registrarDevolucao({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
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
        + Registrar devolução
      </button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Registrar devolução"
      >
        <form key={formKey} action={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="devolucao-colaborador"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Colaborador
            </label>
            <select
              id="devolucao-colaborador"
              name="colaborador_id"
              required
              value={colaboradorId}
              onChange={(e) => handleColaboradorChange(e.target.value)}
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
              htmlFor="devolucao-entrega"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              EPI entregue a devolver
            </label>
            <select
              id="devolucao-entrega"
              required
              disabled={!colaboradorId || carregandoEntregas}
              value={entregaSelecionada?.id ?? ""}
              onChange={(e) => {
                const entrega =
                  entregasEmPosse.find((ev) => ev.id === e.target.value) ??
                  null;
                setEntregaSelecionada(entrega);
              }}
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="" disabled>
                {!colaboradorId
                  ? "Escolha um colaborador"
                  : carregandoEntregas
                    ? "Carregando…"
                    : entregasEmPosse.length === 0
                      ? "Nenhum EPI em posse"
                      : "Selecione…"}
              </option>
              {entregasEmPosse.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.epiNome}
                  {ev.epiCa ? ` — C.A. ${ev.epiCa}` : ""} · entregue em{" "}
                  {formatDate(ev.data)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="devolucao-motivo"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Motivo
              </label>
              <select
                id="devolucao-motivo"
                name="motivo"
                required
                value={motivo}
                onChange={(e) =>
                  setMotivo(e.target.value as MotivoDevolucao)
                }
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
                htmlFor="devolucao-data"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Data
              </label>
              <input
                id="devolucao-data"
                name="data"
                type="date"
                required
                defaultValue={hojeISO()}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="devolucao-destino"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Destino do EPI devolvido
            </label>
            <select
              id="devolucao-destino"
              name="destino"
              required
              disabled={extraviado}
              defaultValue=""
              key={extraviado ? "extraviado" : "normal"}
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {extraviado ? (
                <option value="nao_aplicavel">Não aplicável</option>
              ) : (
                <>
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {DESTINOS.filter(([valor]) => valor !== "nao_aplicavel").map(
                    ([valor, label]) => (
                      <option key={valor} value={valor}>
                        {label}
                      </option>
                    ),
                  )}
                </>
              )}
            </select>
          </div>

          <label className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <input
              type="checkbox"
              name="devolvido_fisicamente"
              disabled={extraviado}
              defaultChecked={!extraviado}
              key={extraviado ? "extraviado-check" : "normal-check"}
              className="h-4 w-4 rounded border-border-strong accent-brand-700"
            />
            O EPI foi devolvido fisicamente
          </label>

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
              {pending ? "Salvando..." : "Registrar devolução"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
