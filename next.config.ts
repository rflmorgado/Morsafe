import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
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
