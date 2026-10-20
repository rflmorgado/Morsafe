"use client";

/**
 * Widget de chat da Mora — assistente de IA do MorSafe, pensada pra tirar
 * dúvidas de visitante do site (funcionalidades, planos, NR-06 etc.) sem
 * precisar falar com alguém. Botão flutuante no canto inferior direito;
 * ao abrir, conversa com o backend em /api/mora (que chama a API da
 * Anthropic com uma base de conhecimento fixa sobre o MorSafe — ver
 * src/app/api/mora/route.ts).
 *
 * Decisões de escopo (20/10/2026, a pedido do Rafael):
 *   - Só aparece na landing page pública (importado direto em page.tsx),
 *     não dentro do app logado — quem já é cliente tem outros canais.
 *   - Sempre mostra um link direto pro WhatsApp/e-mail embaixo do input,
 *     independente do que a IA responde — garante que o visitante sempre
 *     tem uma saída pra falar com gente de verdade, sem depender da IA
 *     "perceber" que não sabe responder.
 *   - Sem persistência (localStorage/etc.) de propósito: é uma conversa
 *     de visitante, curta, não precisa sobreviver a um reload.
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const WHATSAPP_URL =
  "https://wa.me/5511947766392?text=" +
  encodeURIComponent("Oi! Vim pelo site e queria falar com vocês sobre o MorSafe.");
const CONTATO_EMAIL = "contato.morsafe.br@gmail.com";

const SAUDACAO_INICIAL =
  "Oi! Eu sou a Mora 👋 Posso te ajudar a entender como o MorSafe funciona, os planos ou questões sobre a NR-06. O que você quer saber?";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function MoraWidget() {
  const [open, setOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: SAUDACAO_INICIAL },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Balão de "oi, posso ajudar?" aparece uma vez, alguns segundos depois do
  // carregamento — some sozinho ou ao abrir o chat.
  useEffect(() => {
    const t = setTimeout(() => setShowBubble(true), 3500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  function abrir() {
    setOpen(true);
    setShowBubble(false);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function enviar() {
    const texto = input.trim();
    if (!texto || loading) return;

    const historico = [...messages, { role: "user" as const, content: texto }];
    setMessages(historico);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/mora", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: historico }),
      });
      const data = await res.json();

      if (!res.ok || !data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.error ??
              "Desculpa, não consegui responder agora. Pode tentar de novo em instantes, ou falar direto com a nossa equipe ali embaixo.",
          },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Deu um problema de conexão aqui. Pode tentar de novo, ou falar direto com a nossa equipe ali embaixo.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {/* Painel do chat */}
      {open && (
        <div className="flex h-[min(600px,calc(100vh-7rem))] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-card">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border-subtle bg-surface-muted px-4 py-3">
            <Image
              src="/mora/mora-avatar.png"
              alt="Mora"
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-semibold text-foreground">Mora</div>
              <div className="flex items-center gap-1.5 text-[12px] text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                assistente MorSafe
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar chat"
              className="shrink-0 rounded-full p-1.5 text-text-secondary hover:bg-border-subtle hover:text-foreground"
            >
              <IconClose className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <Image
                    src="/mora/mora-avatar.png"
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 rounded-full"
                  />
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "rounded-br-sm bg-brand-700 text-white"
                      : "rounded-bl-sm bg-surface-muted text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-end gap-2">
                <Image
                  src="/mora/mora-avatar.png"
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0 rounded-full"
                />
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface-muted px-3.5 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border-subtle p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                placeholder="Escreva sua dúvida..."
                maxLength={2000}
                className="min-w-0 flex-1 rounded-full border border-border-subtle bg-surface px-4 py-2.5 text-[13.5px] text-foreground outline-none placeholder:text-text-muted focus-visible:border-brand-500"
              />
              <button
                type="button"
                onClick={enviar}
                disabled={loading || !input.trim()}
                aria-label="Enviar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white disabled:opacity-40"
              >
                <IconSend className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 text-center text-[11.5px] text-text-muted">
              Prefere falar com a nossa equipe?{" "}
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-700 hover:underline"
              >
                WhatsApp
              </a>{" "}
              ·{" "}
              <a href={`mailto:${CONTATO_EMAIL}`} className="font-medium text-brand-700 hover:underline">
                e-mail
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Balão de saudação (some ao abrir ou pode ser fechado) */}
      {!open && showBubble && (
        <button
          type="button"
          onClick={abrir}
          className="flex max-w-[240px] items-center gap-2 rounded-2xl rounded-br-sm border border-border-subtle bg-surface px-4 py-3 text-left text-[13px] text-foreground shadow-card hover:shadow-card-hover"
        >
          Oi! Posso te ajudar com alguma dúvida sobre o MorSafe?
        </button>
      )}

      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : abrir())}
        aria-label={open ? "Fechar chat com a Mora" : "Abrir chat com a Mora"}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-700 shadow-btn hover:shadow-btn-hover"
      >
        {open ? (
          <IconClose className="h-6 w-6 text-white" />
        ) : (
          <Image
            src="/mora/mora-avatar.png"
            alt="Abrir chat com a Mora"
            width={56}
            height={56}
            className="h-full w-full object-cover"
          />
        )}
      </button>
    </div>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 12l16-7-7 16-2.5-6.5L4 12Z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
