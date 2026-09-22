import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";

// Título e descrição usados no <title> da aba e nas prévias de
// compartilhamento (WhatsApp, LinkedIn, X).
//
// Texto genérico de propósito — o MorSafe é pensado pra ser usado por
// qualquer empresa cliente (multi-tenant), então nada aqui pode citar
// ViniPlast/Vinitrade especificamente, senão o link fica com a cara da
// empresa errada quando compartilhado com um cliente novo.
const TITULO = "MorSafe";
const DESCRICAO =
  "Nenhuma entrega de EPI sem registro. Nenhum C.A. vencido sem aviso. Conformidade com a NR-06, sem esforço.";

// metadataBase resolve as URLs absolutas do favicon/ícones/OG image (og:image
// etc. exigem URL absoluta pra funcionar direito no WhatsApp/LinkedIn/etc.).
// Aponta pro domínio de produção — os domínios extras (git-main, previews)
// continuam funcionando normalmente, só a URL usada nas prévias de
// compartilhamento é sempre a de produção.
export const metadata: Metadata = {
  metadataBase: new URL("https://morsafe-iota.vercel.app"),
  title: TITULO,
  description: DESCRICAO,
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    siteName: "MorSafe",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
