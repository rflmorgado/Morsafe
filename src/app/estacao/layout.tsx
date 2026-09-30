import type { Metadata, Viewport } from "next";

/**
 * Layout específico da estação de assinatura (/estacao e /estacao/parear) —
 * existe só pra declarar o manifest e as meta tags de "app instalado" que a
 * página não pode exportar sozinha (page.tsx é "use client"; metadata/
 * viewport só funcionam em Server Component). Sem isso, "Adicionar à Tela
 * de Início" cria um favorito comum, não um app: o aparelho abre de novo
 * como aba de navegador normal, com toda a UI do navegador por cima, e some
 * a sensação de "app instalado" que a tela persistente depende (ver
 * comentário em device-storage.ts — o localStorage em si sobrevive, mas sem
 * isto o usuário não tem como saber se está de fato no modo app ou numa
 * aba solta, e no Android especialmente o ícone sem manifest nem aparece
 * como opção de instalar, só de favoritar).
 *
 * start_url/scope do manifest (ver public/manifest-estacao.webmanifest)
 * apontam pra /estacao mesmo que o ícone tenha sido criado a partir de
 * /estacao/parear (tela de pareamento) — depois de parear uma vez, o
 * aparelho deve sempre abrir direto na tela de espera, nunca de volta no
 * QR code.
 */
export const metadata: Metadata = {
  title: "MorSafe — Estação",
  manifest: "/manifest-estacao.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MorSafe",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d2b1c",
};

export default function EstacaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
