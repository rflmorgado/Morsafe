// Ponto de entrada que o Next.js chama automaticamente ao subir o servidor,
// escolhendo a configuração certa do Sentry conforme o runtime (Node.js
// normal ou Edge). Também captura erros não tratados que escapam das rotas.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
