import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";

// metadataBase resolve as URLs absolutas do favicon/ícones/OG image (og:image
// etc. exigem URL absoluta pra funcionar direito no WhatsApp/LinkedIn/etc.).
// Aponta pro domínio de produção — os domínios extras (git-main, previews)
// continuam funcionando normalmente, só a URL usada nas prévias de
// compartilhamento é sempre a de produção.
export const metadata: Metadata = {
  metadataBase: new URL("https://morsafe-iota.vercel.app"),
  title: "MorSafe — Controle de EPI na prática",
  description:
    "Controle de entrega, estoque e conformidade de EPI da ViniPlast e Vinitrade.",
  openGraph: {
    title: "MorSafe — Controle de EPI na prática",
    description:
      "Controle de entrega, estoque e conformidade de EPI da ViniPlast e Vinitrade.",
    siteName: "MorSafe",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MorSafe — Controle de EPI na prática",
    description:
      "Controle de entrega, estoque e conformidade de EPI da ViniPlast e Vinitrade.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
