"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { SignaturePad } from "@/components/ui/signature-pad";
import { registrarDevolucao, buscarEntregasEmPosse } from "./actions";
import {
  criarSolicitacaoAssinatura,
  buscarStatusSolicitacao,
  cancelarSolicitacaoAssinatura,
} from "./solicitacao-assinatura-actions";
import {
  MOTIVO_DEVOLUCAO_LABEL,
  DESTINO_DEVOLUCAO_LABEL,
} from "@/lib/data/movimentacoes-labels";
import type {
  ColaboradorAtivo,
  EntregaEmPosse,
} from "@/lib/data/movimentacoes";
import type { MotivoDevolucao, DestinoDevolucao } from "@/types/database";

const INTERVALO_POLL_MS = 2000;

// Tudo que o formulário precisa pra terminar o registro depois que a
// estação devolver a assinatura (ver pedidoPendente abaixo) — snapshot
// tirado na hora de enviar pra estação, porque o formulário continua
// aberto/editável enquanto se espera, então não dá pra reler os campos do
// FormData outra vez quando a assinatura chegar (mesmo raciocínio de
// CamposEntrega em registrar-entrega-button.tsx).
type CamposDevolucao = {
  colaborador_id: string;
  epi_id: string;
  entrega_vinculada_id: string;
  quantidade: number;
  motivo: string;
  data: string;
  destino: string;
  devolvido_fisicamente: boolean;
};

type PedidoPendente = {
  solicitacaoId: string;
  campos: CamposDevolucao;
};

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
  estacoes = [],
  variant = "outline",
}: {
  colaboradores: ColaboradorAtivo[];
  // Só entra em jogo se a empresa já tiver pelo menos uma estação pareada
  // (ver src/app/(app)/estacoes) — sem isso o formulário funciona exatamente
  // como antes de existir essa opção, sempre com assinatura coletada ali
  // mesmo. Mesmo padrão de registrar-entrega-button.tsx.
  estacoes?: { id: string; nome: string }[];
  // "outline" é o padrão (usado em Movimentações, onde já existe um botão
  // sólido de destaque — Registrar entrega — na mesma toolbar; dois botões
  // sólidos lado a lado ali competiriam pela atenção). "solid" é pro
  // Dashboard, onde "Registrar entrega" já é um botão à parte lá em cima e os
  // atalhos do card "Ações rápidas" devem parecer um conjunto único — ver
  // mesmo raciocínio em registrar-entrada-button.tsx (conversa com Rafael,
  // 01/10/2026).
  variant?: "outline" | "solid";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Força o SignaturePad a remontar (e limpar) a cada abertura do modal.
  const [formKey, setFormKey] = useState(0);

  const [colaboradorId, setColaboradorId] = useState("");
  const [entregasEmPosse, setEntregasEmPosse] = useState<EntregaEmPosse[]>([]);
  const [carregandoEntregas, setCarregandoEntregas] = useState(false);
  const [entregaSelecionada, setEntregaSelecionada] = useState<
    EntregaEmPosse | null
  >(null);
  const [motivo, setMotivo] = useState<MotivoDevolucao | "">("");

  const [modoAssinatura, setModoAssinatura] = useState<"local" | "estacao">(
    "local",
  );
  const [estacaoId, setEstacaoId] = useState(estacoes[0]?.id ?? "");
  const [pedidoPendente, setPedidoPendente] = useState<PedidoPendente | null>(
    null,
  );
  // Só é exigida quando a assinatura é coletada AQUI (modo "local", ver
  // SignaturePad abaixo) — no modo "estacao" a confirmação vem depois, pelo
  // polling. Sem essa checagem no botão, dava pra clicar "Registrar
  // devolução" sem assinar nada: o servidor recusa (registrarDevolucao em
  // actions.ts), mas só depois do vai-e-volta, sem nenhum aviso antes.
  const [assinaturaColetada, setAssinaturaColetada] = useState(false);
  const precisaAssinaturaLocal = !(
    modoAssinatura === "estacao" && estacoes.length > 0
  );
  // Contador de qual foi a última troca de colaborador pedida — numa rede
  // lenta, a resposta de buscarEntregasEmPosse de uma troca ANTERIOR pode
  // chegar depois da troca mais recente. Sem isso, a lista de "EPIs a
  // devolver" ficava com os itens do colaborador ERRADO enquanto o select já
  // mostrava o nome do colaborador certo (era possível, daí, devolver algo
  // em nome de quem não recebeu aquele EPI).
  const requestIdRef = useRef(0);

  const extraviado = motivo === EXTRAVIADO;

  function reset() {
    setColaboradorId("");
    setEntregasEmPosse([]);
    setEntregaSelecionada(null);
    setMotivo("");
    setError(null);
    setAssinaturaColetada(false);
    // Invalida qualquer busca de entregas ainda em andamento, pra não
    // preencher a lista depois que o formulário já foi fechado/limpo.
    requestIdRef.current++;
  }

  function fecharModal() {
    if (pedidoPendente) {
      cancelarSolicitacaoAssinatura(pedidoPendente.solicitacaoId);
    }
    setOpen(false);
    setPedidoPendente(null);
    reset();
  }

  async function handleColaboradorChange(id: string) {
    setColaboradorId(id);
    setEntregaSelecionada(null);
    setEntregasEmPosse([]);
    const requestId = ++requestIdRef.current;
    if (!id) return;
    setCarregandoEntregas(true);
    try {
      const entregas = await buscarEntregasEmPosse(id);
      // Se o colaborador foi trocado de novo enquanto esta busca estava no
      // ar, esta resposta já é velha — aplicá-la agora sobrescreveria a
      // lista do colaborador atual com itens de outro colaborador.
      if (requestId !== requestIdRef.current) return;
      setEntregasEmPosse(entregas);
    } finally {
      if (requestId === requestIdRef.current) setCarregandoEntregas(false);
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (!entregaSelecionada) {
      setError("Selecione qual EPI está sendo devolvido.");
      return;
    }

    const data = String(formData.get("data") ?? "");
    const destino = String(formData.get("destino") ?? "");
    const devolvidoFisicamente = formData.get("devolvido_fisicamente") === "on";

    if (modoAssinatura === "estacao" && estacoes.length > 0) {
      if (!estacaoId) {
        setError("Selecione a estação.");
        return;
      }
      const colaboradorNome =
        colaboradores.find((c) => c.id === colaboradorId)?.nome ?? "";
      const epiResumo = `${entregaSelecionada.epiNome}${
        entregaSelecionada.epiCa ? ` — C.A. ${entregaSelecionada.epiCa}` : ""
      } · ${entregaSelecionada.quantidade} un.`;

      startTransition(async () => {
        const result = await criarSolicitacaoAssinatura({
          estacaoId,
          colaboradorNome,
          epiNome: epiResumo,
          tipo: "devolucao",
        });
        if (result.error || !result.id) {
          setError(result.error ?? "Não foi possível enviar pra estação.");
          return;
        }
        setPedidoPendente({
          solicitacaoId: result.id,
          campos: {
            colaborador_id: colaboradorId,
            epi_id: entregaSelecionada.epiId,
            entrega_vinculada_id: entregaSelecionada.id,
            quantidade: entregaSelecionada.quantidade,
            motivo,
            data,
            destino,
            devolvido_fisicamente: devolvidoFisicamente,
          },
        });
      });
      return;
    }

    formData.set("epi_id", entregaSelecionada.epiId);
    formData.set("entrega_vinculada_id", entregaSelecionada.id);
    formData.set("quantidade", String(entregaSelecionada.quantidade));
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

  // Enquanto aguarda, consulta o pedido a cada ~2s — assim que a estação
  // enviar a assinatura, completa o registro de devolução normalmente
  // (mesma Server Action de sempre, só que com a assinatura vinda de lá).
  // Mesmo padrão de registrar-entrega-button.tsx.
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
        fd.set("entrega_vinculada_id", pedidoPendente.campos.entrega_vinculada_id);
        fd.set("quantidade", String(pedidoPendente.campos.quantidade));
        fd.set("motivo", pedidoPendente.campos.motivo);
        fd.set("data", pedidoPendente.campos.data);
        fd.set("destino", pedidoPendente.campos.destino);
        if (pedidoPendente.campos.devolvido_fisicamente) {
          fd.set("devolvido_fisicamente", "on");
        }
        fd.set("assinatura_url", result.assinaturaUrl);

        const final = await registrarDevolucao({ error: null }, fd);
        if (cancelado) return;
        if (final.error) {
          setError(final.error);
          setPedidoPendente(null);
          return;
        }
        setOpen(false);
        setFormKey((k) => k + 1);
        setPedidoPendente(null);
        reset();
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
        className={
          variant === "solid"
            ? "rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
            : "rounded-lg border border-border-strong px-4 py-2.5 text-[13.5px] font-semibold text-foreground transition hover:bg-surface-muted"
        }
      >
        + Registrar devolução
      </button>

      <Modal open={open} onClose={fecharModal} title="Registrar devolução">
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
              Peça pro colaborador assinar no aparelho, confirmando a
              devolução. Esta tela completa o registro sozinha assim que a
              assinatura chegar.
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
                  {ev.quantidade > 1 ? `${ev.quantidade}x ` : ""}
                  {ev.epiNome}
                  {ev.epiCa ? ` — C.A. ${ev.epiCa}` : ""} · entregue em{" "}
                  {formatDate(ev.data)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            {/*
              Quando extraviado, o select fica desabilitado só visualmente —
              um <select> com `disabled` é excluído do FormData no submit,
              então sem o input escondido abaixo o servidor nunca recebia
              "destino" nesse caso e `registrarDevolucao` rejeitava sempre
              com "Selecione o colaborador, o EPI entregue, o motivo, o
              destino e a data", mesmo com tudo preenchido certo — o cenário
              de EPI extraviado (um dos mais relevantes pra prova numa
              fiscalização) nunca conseguia ser registrado. O input escondido
              carrega o valor de verdade pro servidor; o select desabilitado
              continua só pra mostrar "Não aplicável" visualmente.
            */}
            {extraviado && (
              <input type="hidden" name="destino" value="nao_aplicavel" />
            )}
            <select
              id="devolucao-destino"
              name={extraviado ? undefined : "destino"}
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

          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
              Confirmação da devolução
            </label>

            {estacoes.length > 0 && (
              <div className="mb-2.5 flex gap-1.5 rounded-lg bg-surface-muted p-1">
                <button
                  type="button"
                  onClick={() => {
                    setModoAssinatura("local");
                    // O SignaturePad remonta em branco ao voltar pra esse
                    // modo (só é renderizado quando modoAssinatura ===
                    // "local") — sem isso, assinaturaColetada ficava com o
                    // valor de antes de trocar de aba, destravando o botão
                    // de enviar mesmo com o campo vazio de novo.
                    setAssinaturaColetada(false);
                  }}
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
              <SignaturePad
                name="assinatura_url"
                onAssinaturaChange={setAssinaturaColetada}
              />
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
              disabled={pending || (precisaAssinaturaLocal && !assinaturaColetada)}
              className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Registrar devolução"}
            </button>
          </div>
        </form>
        )}
      </Modal>
    </>
  );
}
