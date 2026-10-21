"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

// Widget de CAPTCHA (Cloudflare Turnstile) — item da auditoria de segurança
// de 21/10/2026: login e recuperação de senha são os dois únicos endpoints
// públicos de autenticação do Supabase usados pelo MorSafe (novos usuários
// são criados pelo admin via service role, não por signUp público — ver
// src/app/(app)/usuarios/actions.ts), então são os dois que precisam de
// proteção contra força bruta/automação.
//
// A Site Key abaixo é pública por natureza (é enviada ao navegador de
// qualquer visitante, igual uma chave anon do Supabase) — só funciona para
// os domínios cadastrados no painel da Cloudflare (morsafe.com.br e
// www.morsafe.com.br). A Secret Key correspondente NUNCA entra no código:
// ela fica só na configuração do Supabase (Authentication → Attack
// Protection), que é quem valida o token no servidor do Supabase.
const TURNSTILE_SITE_KEY = "0x4AAAAAAFfPzCj9d_4t6CJB";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export function TurnstileWidget({
  onToken,
}: {
  onToken: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.turnstile) return;
    // Evita renderizar duas vezes (ex.: StrictMode em dev rodando o efeito
    // duas vezes).
    if (widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // onToken é sempre um setState do componente pai (referência estável
    // entre renders) — incluí-lo aqui não causa recriações extras do
    // widget.
  }, [scriptReady, onToken]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} />
    </>
  );
}
