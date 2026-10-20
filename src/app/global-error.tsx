"use client";

// Rede de segurança final: captura qualquer erro que escape de todas as
// páginas e layouts (até do layout raiz) e envia pro Sentry antes de
// mostrar uma tela de erro genérica ao usuário. Sem isso, um erro fatal no
// layout raiz nunca apareceria no Sentry.
import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        {/* statusCode={0} porque o App Router não expõe o código HTTP aqui */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
