import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */

  // Cabeçalhos de segurança aplicados a toda resposta — item da auditoria de
  // segurança de 21/10/2026 (CLAUDE.md não cobre isso, mas segue o mesmo
  // espírito: fechar o que dá pra fechar sem custo nem risco de quebrar
  // nada). Deliberadamente NÃO inclui uma CSP completa (script-src/style-src
  // etc.) — isso exigiria mapear toda origem externa usada pelo app (Sentry,
  // Supabase, fontes, o widget da Mora) e testar cada página; fica para uma
  // iteração futura, feita com calma.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Impede que o site seja carregado dentro de <iframe> em outro
          // domínio — mitiga clickjacking. DENY porque nenhuma página do
          // MorSafe precisa ser embutida em outro site.
          { key: "X-Frame-Options", value: "DENY" },
          // Mesma proteção, forma moderna (cobre o que X-Frame-Options não
          // cobre em alguns navegadores) — redundante de propósito.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Impede o navegador de "adivinhar" o tipo de um arquivo servido
          // com Content-Type diferente do real (reduz risco de XSS via
          // upload/download de arquivo).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Não vaza a URL completa de origem em requisições cross-site —
          // só a origem, e só quando o destino também é HTTPS.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // O app não usa câmera, microfone nem geolocalização em nenhuma
          // tela (conferido por grep antes de adicionar esta linha) — nega
          // os três por padrão.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "morsafe",
  project: "javascript-nextjs",

  // Só mostra os logs detalhados do build do Sentry no CI (Vercel), pra não
  // poluir o terminal durante o desenvolvimento local.
  silent: !process.env.CI,

  // Faz upload dos source maps pro Sentry automaticamente no build, pra
  // conseguirmos ver o código-fonte real (não minificado) nos erros. Sem um
  // SENTRY_AUTH_TOKEN configurado, essa etapa é simplesmente pulada — não
  // quebra o build.
  widenClientFileUpload: true,
});
