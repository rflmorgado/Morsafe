"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ShieldIcon } from "@/components/brand/shield-icon";
import { SignaturePad } from "@/components/ui/signature-pad";
import {
  buscarSolicitacaoPendente,
  responderSolicitacaoAssinatura,
  type SolicitacaoPendente,
} from "./actions";
import {
  limparCredencialEstacao,
  assinarCredencialEstacao,
  getTokenEstacaoSnapshot,
  getTokenEstacaoSnapshotServidor,
  getNomeEstacaoSnapshot,
  getNomeEstacaoSnapshotServidor,
  TOKEN_ESTACAO_PLACEHOLDER_SSR,
} from "@/lib/estacao-assinatura/device-storage";

const INTERVALO_POLL_MS = 2000;

type Fase =
  | "carregando"
  | "nao_pareado"
  | "ocioso"
  | "assinando"
  | "enviando"
  | "enviado"
  | "erro_aparelho";

/**
 * Tela persistente de um aparelho pareado (tablet/celular da empresa fixado
 * num ponto de coleta — ver /estacoes) — pensada pra ficar sempre aberta
 * ("adicionar à tela inicial" no navegador do aparelho), sem navegação
 * nenhuma. Fica consultando o servidor sozinha (ver INTERVALO_POLL_MS) e só
 * muda de tela quando chega um pedido de assinatura vindo de um PC que
 * escolheu "coletar na estação" ao registrar uma entrega.
 */
export default function EstacaoPage() {
  // Credencial pareada (ver device-storage.ts) lida via useSyncExternalStore
  // em vez de useEffect+setState: o servidor nunca tem localStorage, e esse
  // hook já garante que o primeiro paint do cliente bate com o do servidor
  // (placeholder "carregando") antes de assumir o valor de verdade.
  const tokenArmazenado = useSyncExternalStore(
    assinarCredencialEstacao,
    getTokenEstacaoSnapshot,
    getTokenEstacaoSnapshotServidor,
  );
  const nomeArmazenado = useSyncExternalStore(
    assinarCredencialEstacao,
    getNomeEstacaoSnapshot,
    getNomeEstacaoSnapshotServidor,
  );
  const carregandoCredencial = tokenArmazenado === TOKEN_ESTACAO_PLACEHOLDER_SSR;
  const token = carregandoCredencial ? null : tokenArmazenado;

  // Fase "de assinatura" — tudo que acontece depois de já saber se está
  // pareado ou não (isso já vem só do token acima).
  const [faseAssinatura, setFaseAssinatura] = useState<
    "ocioso" | "assinando" | "enviando" | "enviado" | "erro_aparelho"
  >("ocioso");
  const [solicitacao, setSolicitacao] = useState<SolicitacaoPendente | null>(
    null,
  );
  const [erro, setErro] = useState<string | null>(null);
  // Nome vindo do último poll ao servidor tem prioridade (reflete uma
  // renomeação feita pelo admin depois do pareamento); até o primeiro poll
  // responder, usa o nome salvo localmente na hora do pareamento.
  const [estacaoNomeAoVivo, setEstacaoNomeAoVivo] = useState<string | null>(
    null,
  );
  const estacaoNome = estacaoNomeAoVivo ?? nomeArmazenado;

  const fase: Fase = carregandoCredencial
    ? "carregando"
    : token === null
      ? "nao_pareado"
      : faseAssinatura;

  const faseRef = useRef<Fase>(fase);
  useEffect(() => {
    faseRef.current = fase;
  }, [fase]);

  // Guarda o id do pedido atualmente em tela fora do estado React, pra
  // poder ser lido e atualizado de forma síncrona dentro de poll() sem
  // depender do timing de re-render/efeito (ver comentário abaixo sobre
  // por que isso importa pra detectar pedido cancelado).
  const solicitacaoIdRef = useRef<string | null>(null);

  const poll = useCallback(async (t: string) => {
    const result = await buscarSolicitacaoPendente(t);
    if (result.error !== null) {
      setErro(result.error);
      setFaseAssinatura("erro_aparelho");
      return;
    }
    setEstacaoNomeAoVivo(result.estacaoNome);

    if (faseRef.current === "ocioso") {
      if (result.solicitacao) {
        solicitacaoIdRef.current = result.solicitacao.id;
        setSolicitacao(result.solicitacao);
        setFaseAssinatura("assinando");
      }
      return;
    }

    // Continua consultando o servidor mesmo já mostrando a tela de
    // assinatura (nunca durante "enviando" — o efeito abaixo pausa o
    // polling sozinho nessa fase, pra não competir com o envio em
    // andamento) só pra detectar se ESTE pedido foi cancelado pelo PC
    // enquanto o colaborador ainda estava assinando. Sem isso, a estação
    // ficava travada pra sempre nessa tela — sem novo poll e sem nenhum
    // jeito de sair a não ser recarregar o aparelho manualmente (Item 5 da
    // revisão: "estação de assinatura órfã trava").
    if (
      faseRef.current === "assinando" &&
      solicitacaoIdRef.current &&
      result.solicitacao?.id !== solicitacaoIdRef.current
    ) {
      solicitacaoIdRef.current = null;
      setSolicitacao(null);
      setErro("Este pedido foi cancelado. Aguardando o próximo registro…");
      setFaseAssinatura("ocioso");
    }
  }, []);

  useEffect(() => {
    if (!token || (fase !== "ocioso" && fase !== "assinando")) return;
    // Dispara a primeira consulta já no próximo tick (não direto aqui no
    // corpo do efeito) e depois entra no intervalo normal.
    const primeira = setTimeout(() => poll(token), 0);
    const id = setInterval(() => poll(token), INTERVALO_POLL_MS);
    return () => {
      clearTimeout(primeira);
      clearInterval(id);
    };
  }, [token, fase, poll]);

  function handleEnviarAssinatura(formData: FormData) {
    if (!token || !solicitacao) return;
    const assinaturaUrl = String(formData.get("assinatura_url") ?? "");
    if (!assinaturaUrl) {
      setErro("Peça pro colaborador assinar antes de enviar.");
      return;
    }

    setErro(null);
    setFaseAssinatura("enviando");

    responderSolicitacaoAssinatura(token, solicitacao.id, assinaturaUrl)
      .then((result) => {
        if (result.error) {
          setErro(result.error);
          if (result.aparelhoInvalido) {
            // Estação foi desativada pelo admin nesse meio-tempo — mesmo
            // tratamento que o poll() já dá em qualquer outra hora.
            solicitacaoIdRef.current = null;
            setSolicitacao(null);
            setFaseAssinatura("erro_aparelho");
            return;
          }
          if (result.orfao) {
            // Pedido não está mais "aguardando" (foi cancelado ou já
            // respondido em outra aba) — insistir nele não adianta, melhor
            // voltar a aguardar o próximo (ver Item 5 da revisão).
            solicitacaoIdRef.current = null;
            setSolicitacao(null);
            setFaseAssinatura("ocioso");
            return;
          }
          // Erro genérico (ex: falha momentânea no banco) — mantém a
          // mesma tela de assinatura pra permitir tentar de novo.
          setFaseAssinatura("assinando");
          return;
        }
        setFaseAssinatura("enviado");
        setTimeout(() => {
          solicitacaoIdRef.current = null;
          setSolicitacao(null);
          setFaseAssinatura("ocioso");
        }, 1800);
      })
      .catch((e) => {
        // Sem este catch, uma queda de rede no meio do envio deixava o botão
        // preso em "Enviando..." pra sempre — sem erro, sem jeito de tentar
        // de novo a não ser recarregar a página (nada óbvio numa tela de
        // quiosque que fica sempre aberta e sem navegação).
        console.error("handleEnviarAssinatura:", e);
        setErro(
          "Falha de conexão ao enviar a assinatura. Verifique a internet e tente novamente.",
        );
        setFaseAssinatura("assinando");
      });
  }

  function handleTrocarAparelho() {
    if (
      !window.confirm(
        "Desparear este aparelho? Ele vai parar de receber pedidos de assinatura até ser pareado de novo pelo administrador.",
      )
    ) {
      return;
    }
    limparCredencialEstacao();
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-10 text-center"
      style={{ background: "var(--brand-950)" }}
    >
      <div className="flex items-center gap-2.5">
        <ShieldIcon className="h-8 w-8" />
        <span className="text-xl font-bold tracking-tight text-brand-300">
          Mor<span className="font-extrabold text-brand-500">Safe</span>
        </span>
      </div>

      {fase === "carregando" && (
        <p className="text-[14px] text-white/60">Carregando…</p>
      )}

      {fase === "nao_pareado" && (
        <div className="max-w-sm space-y-2">
          <p className="text-[15px] font-semibold text-white">
            Este aparelho não está pareado
          </p>
          <p className="text-[13px] text-white/60">
            Peça pro administrador gerar um QR de pareamento na tela
            &ldquo;Estações de assinatura&rdquo; do MorSafe e escaneie aqui.
          </p>
        </div>
      )}

      {fase === "erro_aparelho" && (
        <div className="max-w-sm space-y-3">
          <p className="text-[15px] font-semibold text-danger-text">
            {erro ?? "Este aparelho não está mais autorizado."}
          </p>
          <p className="text-[13px] text-white/60">
            Peça pro administrador gerar um novo código de pareamento pra
            esta estação.
          </p>
          <button
            type="button"
            onClick={handleTrocarAparelho}
            className="rounded-lg bg-white/10 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white/20"
          >
            Parear novamente
          </button>
        </div>
      )}

      {fase === "ocioso" && (
        <div className="max-w-sm space-y-2">
          <div className="mx-auto h-2.5 w-2.5 animate-pulse rounded-full bg-brand-500" />
          <p className="text-[15px] font-semibold text-white">
            {estacaoNome ?? "Estação"}
          </p>
          <p className="text-[13px] text-white/60">
            Aguardando o próximo registro de EPI para assinatura…
          </p>
        </div>
      )}

      {(fase === "assinando" || fase === "enviando") && solicitacao && (
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-5 text-left">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-text-muted">
            Confirmação de recebimento de EPI
          </p>
          <p className="mt-1 text-[17px] font-bold text-foreground">
            {solicitacao.colaboradorNome}
          </p>
          <p className="text-[13.5px] text-text-secondary">
            {solicitacao.epiNome}
          </p>

          <form action={handleEnviarAssinatura} className="mt-4 space-y-3">
            <SignaturePad />

            {erro && (
              <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={fase === "enviando"}
              className="w-full rounded-lg bg-brand-700 px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {fase === "enviando" ? "Enviando..." : "Confirmar assinatura"}
            </button>
          </form>
        </div>
      )}

      {fase === "enviado" && (
        <div className="space-y-1">
          <p className="text-[17px] font-bold text-white">✓ Assinatura enviada</p>
          <p className="text-[13px] text-white/60">
            Voltando a aguardar o próximo registro…
          </p>
        </div>
      )}

      {fase === "ocioso" && (
        <button
          type="button"
          onClick={handleTrocarAparelho}
          className="mt-4 text-[11.5px] text-white/30 underline-offset-2 hover:text-white/50 hover:underline"
        >
          Não é este o aparelho certo? Desparear
        </button>
      )}
    </div>
  );
}
