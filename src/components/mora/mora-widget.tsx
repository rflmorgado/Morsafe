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
  "https://wa.me/5511927500869?text=" +
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
  // carregamento — e some sozinho pouco depois se ninguém clicar nele.
  // Antes ele ficava aberto pra sempre até o chat ser aberto, e como o
  // widget é fixed (acompanha a tela, não a página), isso significava que
  // ele acabava cobrindo qualquer título que estivesse naquele canto
  // quando o visitante rolasse a página — reportado pelo Rafael (20/10/2026)
  // cobrindo o título "Um resumo em vídeo..." no mobile. Com o auto-hide,
  // a janela em que isso pode acontecer cai de "indefinida" pra ~8s.
  useEffect(() => {
    const t = setTimeout(() => setShowBubble(true), 3500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!showBubble) return;
    const t = setTimeout(() => setShowBubble(false), 8000);
    return () => clearTimeout(t);
  }, [showBubble]);

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
