"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { SignaturePad } from "@/components/ui/signature-pad";
import { registrarEntrega, buscarSaldoEstoque } from "./actions";
import {
  criarSolicitacaoAssinatura,
  buscarStatusSolicitacao,
  cancelarSolicitacaoAssinatura,
} from "./solicitacao-assinatura-actions";
import { MOTIVO_ENTREGA_LABEL } from "@/lib/data/movimentacoes-labels";
import type { ColaboradorAtivo, EpiAtivo } from "@/lib/data/movimentacoes";
import type { MotivoEntrega } from "@/types/database";

const INTERVALO_POLL_MS = 2000;

// Um item da entrega (EPI + motivo + quantidade) — a entrega inteira pode
// ter vários, pedido do Rafael em 06/10/2026 ("em uma integração, nós
// entregamos mais de um tipo de EPI... 'adicione mais itens', pra não
// precisar abrir a tela várias vezes"). `key` é só identidade de UI (pra
// React/remover item), nunca vai pro servidor.
type ItemFormulario = {
  key: number;
  epiId: string;
  motivo: string;
  quantidade: number;
  saldoAtual: number | null;
};

function itemVazio(key: number): ItemFormulario {
  return { key, epiId: "", motivo: "", quantidade: 1, saldoAtual: null };
}

type CamposEntrega = {
  colaborador_id: string;
  data: string;
  hora: string;
  itens: { epiId: string; motivo: string; quantidade: number }[];
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

  // Só é exigida quando a assinatura é coletada AQUI (modo "local", ver
  // SignaturePad abaixo) — no modo "estacao" a confirmação vem depois, pelo
  // polling. Sem essa checagem no botão, dava pra clicar "Registrar
  // entrega" sem assinar nada: o servidor recusa (registrarEntrega em
  // actions.ts), mas só depois do vai-e-volta, sem nenhum aviso antes.
  const [assinaturaColetada, setAssinaturaColetada] = useState(false);
  const precisaAssinaturaLocal = !(
    modoAssinatura === "estacao" && estacoes.length > 0
  );

  // Lista de itens da entrega — sempre começa com um item em branco; o
  // botão "+ Adicionar outro item" empilha mais, nunca menos de um.
  const [itens, setItens] = useState<ItemFormulario[]>(() => [itemVazio(0)]);
  const proximaKeyRef = useRef(1);
  // Guarda de requisição de saldo DE ESTOQUE, por item (igual ao raciocínio
  // já usado no formulário de devolução): troca o EPI de um item duas vezes
  // rápido e a resposta da primeira chega depois da segunda — sem isso, o
  // saldo mostrado podia acabar sendo do EPI errado.
  const saldoRequestIdRef = useRef<Map<number, number>>(new Map());

  function resetarItens() {
    setItens([itemVazio(0)]);
    proximaKeyRef.current = 1;
    saldoRequestIdRef.current.clear();
  }

  function adicionarItem() {
    const key = proximaKeyRef.current++;
    setItens((prev) => [...prev, itemVazio(key)]);
  }

  function removerItem(key: number) {
    setItens((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  }

  function atualizarItem(key: number, patch: Partial<ItemFormulario>) {
    setItens((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function handleItemEpiChange(key: number, epiId: string) {
    atualizarItem(key, { epiId, saldoAtual: null });
    const requestId = (saldoRequestIdRef.current.get(key) ?? 0) + 1;
    saldoRequestIdRef.current.set(key, requestId);
    if (!epiId) return;
    const saldo = await buscarSaldoEstoque(epiId);
    if (saldoRequestIdRef.current.get(key) !== requestId) return;
    atualizarItem(key, { saldoAtual: saldo });
  }

  function fecharModal() {
    if (pedidoPendente) {
      cancelarSolicitacaoAssinatura(pedidoPendente.solicitacaoId);
    }
    setOpen(false);
    setPedidoPendente(null);
    setError(null);
    setAssinaturaColetada(false);
    resetarItens();
  }

  // Itens incompletos (sem EPI ou sem motivo escolhido) travam o envio —
  // conferido antes de chamar o servidor OU de abrir o pedido pra estação,
  // pra dar o aviso na hora em vez de só depois de um vai-e-volta.
  function itensIncompletos() {
    return itens.some((i) => !i.epiId || !i.motivo);
  }

  function handleSubmit(formData: FormData) {
    setError(null);

    if (itensIncompletos()) {
      setError("Preencha o EPI e o motivo de todos os itens.");
      return;
    }

    const colaboradorId = String(formData.get("colaborador_id") ?? "");
    const data = String(formData.get("data") ?? "");
    const hora = String(formData.get("hora") ?? "");

    if (modoAssinatura === "estacao") {
      const colaboradorNome =
        colaboradores.find((c) => c.id === colaboradorId)?.nome ?? "";
      // Resumo com um item por linha — a estação (tablet) mostra isso
      // literalmente na tela antes de pedir a assinatura (ver
      // src/app/estacao/page.tsx, classe whitespace-pre-line), pra quem vai
      // assinar conseguir conferir TUDO que está recebendo, não só o
      // primeiro item.
      const epiNomeResumo = itens
        .map((i) => {
          const epi = epis.find((e) => e.id === i.epiId);
          return `${epi?.nome ?? "EPI"}${epi?.ca ? ` — C.A. ${epi.ca}` : ""} · ${i.quantidade} un.`;
        })
        .join("\n");

      if (!colaboradorId || !estacaoId) {
        setError("Selecione colaborador e a estação.");
        return;
      }

      startTransition(async () => {
        const result = await criarSolicitacaoAssinatura({
          estacaoId,
          colaboradorNome,
          epiNome: epiNomeResumo,
          tipo: "entrega",
        });
        if (result.error || !result.id) {
          setError(result.error ?? "Não foi possível enviar pra estação.");
          return;
        }
        setPedidoPendente({
          solicitacaoId: result.id,
          campos: {
            colaborador_id: colaboradorId,
            data,
            hora,
            itens: itens.map((i) => ({
              epiId: i.epiId,
              motivo: i.motivo,
              quantidade: i.quantidade,
            })),
          },
        });
      });
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("colaborador_id", colaboradorId);
      fd.set("data", data);
      fd.set("hora", hora);
      fd.set(
        "itens",
        JSON.stringify(
          itens.map((i) => ({
            epi_id: i.epiId,
            motivo: i.motivo,
            quantidade: i.quantidade,
          })),
        ),
      );
      fd.set("assinatura_url", String(formData.get("assinatura_url") ?? ""));

      const result = await registrarEntrega({ error: null }, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setFormKey((k) => k + 1);
      setAssinaturaColetada(false);
      resetarItens();
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
        fd.set("data", pedidoPendente.campos.data);
        fd.set("hora", pedidoPendente.campos.hora);
        fd.set(
          "itens",
          JSON.stringify(
            pedidoPendente.campos.itens.map((i) => ({
              epi_id: i.epiId,
              motivo: i.motivo,
              quantidade: i.quantidade,
            })),
          ),
        );
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
        setAssinaturaColetada(false);
        resetarItens();
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
              Peça pro colaborador assinar no aparelho, confirmando os{" "}
              {pedidoPendente.campos.itens.length}{" "}
              {pedidoPendente.campos.itens.length > 1 ? "itens" : "item"}.
              Esta tela completa o registro sozinha assim que a assinatura
              chegar.
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

          <div className="space-y-3">
            <label className="block text-[12.5px] font-semibold text-text-secondary">
              Itens da entrega
            </label>

            {itens.map((item, index) => (
              <div
                key={item.key}
                className="space-y-3 rounded-lg border border-border-strong bg-surface-muted/40 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">
                    Item {index + 1}
                  </span>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerItem(item.key)}
                      className="text-[12px] font-semibold text-danger-text hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
                    EPI
                  </label>
                  <select
                    required
                    value={item.epiId}
                    onChange={(e) => handleItemEpiChange(item.key, e.target.value)}
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
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
                      Motivo
                    </label>
                    <select
                      required
                      value={item.motivo}
                      onChange={(e) =>
                        atualizarItem(item.key, { motivo: e.target.value })
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
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      required
                      value={item.quantidade}
                      onChange={(e) =>
                        atualizarItem(item.key, {
                          quantidade: Number(e.target.value) || 1,
                        })
                      }
                      className="w-20 rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                </div>

                {item.saldoAtual !== null && item.quantidade > item.saldoAtual && (
                  <p className="rounded-lg bg-warning-bg px-3.5 py-2.5 text-[12.5px] text-warning-text">
                    Estoque atual deste EPI: {item.saldoAtual}. Registrar{" "}
                    {item.quantidade}{" "}
                    {item.quantidade > 1 ? "unidades" : "unidade"} deixa o
                    saldo negativo ({item.saldoAtual - item.quantidade}). A
                    entrega pode ser registrada mesmo assim — ajuste o
                    estoque depois, se for o caso.
                  </p>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={adicionarItem}
              className="w-full rounded-lg border border-dashed border-border-strong px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-700 transition hover:bg-brand-50"
            >
              + Adicionar outro item
            </button>
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
              disabled={
                pending ||
                (precisaAssinaturaLocal && !assinaturaColetada) ||
                itensIncompletos()
              }
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
