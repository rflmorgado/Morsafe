"use client";

import { useEffect, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { SignaturePad } from "@/components/ui/signature-pad";
import { registrarEntrega } from "./actions";
import {
  criarSolicitacaoAssinatura,
  buscarStatusSolicitacao,
  cancelarSolicitacaoAssinatura,
} from "./solicitacao-assinatura-actions";
import { MOTIVO_ENTREGA_LABEL } from "@/lib/data/movimentacoes-labels";
import type { ColaboradorAtivo, EpiAtivo } from "@/lib/data/movimentacoes";
import type { MotivoEntrega } from "@/types/database";

const INTERVALO_POLL_MS = 2000;

type CamposEntrega = {
  colaborador_id: string;
  epi_id: string;
  motivo: string;
  quantidade: string;
  data: string;
  hora: string;
};

type PedidoPendente = {
  solicitacaoId: string;
  campos: CamposEntrega;
};

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
  estacoes = [],
}: {
  colaboradores: ColaboradorAtivo[];
  epis: EpiAtivo[];
  estacoes?: { id: string; nome: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Força o SignaturePad a remontar (e limpar) a cada abertura do modal.
  const [formKey, setFormKey] = useState(0);

  // Só entra em jogo se a empresa já tiver pelo menos uma estação pareada
  // (ver src/app/(app)/estacoes) — sem isso o formulário funciona exatamente
  // como antes, sempre com assinatura coletada ali mesmo.
  const [modoAssinatura, setModoAssinatura] = useState<"local" | "estacao">(
    "local",
  );
  const [estacaoId, setEstacaoId] = useState(estacoes[0]?.id ?? "");
  const [pedidoPendente, setPedidoPendente] = useState<PedidoPendente | null>(
    null,
  );

  function fecharModal() {
    if (pedidoPendente) {
      cancelarSolicitacaoAssinatura(pedidoPendente.solicitacaoId);
    }
    setOpen(false);
    setPedidoPendente(null);
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);

    if (modoAssinatura === "estacao") {
      const colaboradorId = String(formData.get("colaborador_id") ?? "");
      const epiId = String(formData.get("epi_id") ?? "");
      const colaboradorNome =
        colaboradores.find((c) => c.id === colaboradorId)?.nome ?? "";
      const epiNome = epis.find((e) => e.id === epiId)?.nome ?? "";

      if (!colaboradorId || !epiId || !estacaoId) {
        setError("Selecione colaborador, EPI e a estação.");
        return;
      }

      startTransition(async () => {
        const result = await criarSolicitacaoAssinatura({
          estacaoId,
          colaboradorNome,
          epiNome,
        });
        if (result.error || !result.id) {
          setError(result.error ?? "Não foi possível enviar pra estação.");
          return;
        }
        setPedidoPendente({
          solicitacaoId: result.id,
          campos: {
            colaborador_id: colaboradorId,
            epi_id: epiId,
            motivo: String(formData.get("motivo") ?? ""),
            quantidade: String(formData.get("quantidade") ?? "1"),
            data: String(formData.get("data") ?? ""),
            hora: String(formData.get("hora") ?? ""),
          },
        });
      });
      return;
    }

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

  // Enquanto aguarda, consulta o pedido a cada ~2s — assim que a estação
  // enviar a assinatura, completa o registro de entrega normalmente (mesma
  // Server Action de sempre, só que com a assinatura vinda de lá).
  useEffect(() => {
    if (!pedidoPendente) return;
    let cancelado = false;

    const id = setInterval(async () => {
      const result = await buscarStatusSolicitacao(
        pedidoPendente.solicitacaoId,
      );
      if (cancelado) return;

      if (result.status === "assinado" && result.assinaturaUrl) {
        clearInterval(id);
        const fd = new FormData();
        fd.set("colaborador_id", pedidoPendente.campos.colaborador_id);
        fd.set("epi_id", pedidoPendente.campos.epi_id);
        fd.set("motivo", pedidoPendente.campos.motivo);
        fd.set("quantidade", pedidoPendente.campos.quantidade);
        fd.set("data", pedidoPendente.campos.data);
        fd.set("hora", pedidoPendente.campos.hora);
        fd.set("assinatura_url", result.assinaturaUrl);

        const final = await registrarEntrega({ error: null }, fd);
        if (cancelado) return;
        if (final.error) {
          setError(final.error);
          setPedidoPendente(null);
          return;
        }
        setOpen(false);
        setFormKey((k) => k + 1);
        setPedidoPendente(null);
      } else if (result.status === "cancelado" || result.status === "expirado") {
        clearInterval(id);
        setError("O pedido de assinatura foi cancelado.");
        setPedidoPendente(null);
      }
    }, INTERVALO_POLL_MS);

    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [pedidoPendente]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
      >
        + Registrar entrega
      </button>

      <Modal open={open} onClose={fecharModal} title="Registrar entrega">
        {pedidoPendente ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto h-2.5 w-2.5 animate-pulse rounded-full bg-brand-500" />
            <p className="text-[14px] font-semibold text-foreground">
              Aguardando assinatura na estação
              {estacoes.find((e) => e.id === estacaoId)
                ? ` "${estacoes.find((e) => e.id === estacaoId)?.nome}"`
                : ""}
              …
            </p>
            <p className="text-[13px] text-text-secondary">
              Peça pro colaborador assinar no aparelho. Esta tela completa o
              registro sozinha assim que a assinatura chegar.
            </p>
            {error && (
              <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={fecharModal}
              className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
            >
              Cancelar
            </button>
          </div>
        ) : (
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

            {estacoes.length > 0 && (
              <div className="mb-2.5 flex gap-1.5 rounded-lg bg-surface-muted p-1">
                <button
                  type="button"
                  onClick={() => setModoAssinatura("local")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition ${
                    modoAssinatura === "local"
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-text-secondary hover:text-foreground"
                  }`}
                >
                  Assinar aqui
                </button>
                <button
                  type="button"
                  onClick={() => setModoAssinatura("estacao")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition ${
                    modoAssinatura === "estacao"
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-text-secondary hover:text-foreground"
                  }`}
                >
                  Coletar na estação
                </button>
              </div>
            )}

            {modoAssinatura === "estacao" && estacoes.length > 0 ? (
              <select
                name="estacao_id"
                required
                value={estacaoId}
                onChange={(e) => setEstacaoId(e.target.value)}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                {estacoes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            ) : (
              <SignaturePad name="assinatura_url" />
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={fecharModal}
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
        )}
      </Modal>
    </>
  );
}
