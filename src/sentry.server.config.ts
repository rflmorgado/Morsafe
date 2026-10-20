// Inicialização do Sentry no lado do servidor (Node.js — API routes, server
// actions, componentes de servidor). Carregado pelo src/instrumentation.ts.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
