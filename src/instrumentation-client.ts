// Inicialização do Sentry no lado do navegador (client-side).
//
// Este arquivo roda automaticamente antes de qualquer código da aplicação,
// em toda página. Captura erros de JavaScript que acontecem no navegador do
// usuário (ex: tela branca, botão quebrado) e envia pro Sentry já marcados
// com o contexto da empresa/usuário logado (ver src/lib/data/current-user.ts).
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Em produção não precisamos rastrear 100% das transações de performance
  // (custaria cota à toa); em dev vale capturar tudo pra debugar.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Evita ruído: não envia nada se o DSN não estiver configurado (ex:
  // ambiente de dev local sem a variável definida).
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});

// Necessário pro Sentry rastrear navegações entre páginas (App Router).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
