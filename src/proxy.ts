import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renomeou middleware.ts -> proxy.ts (mesma funcionalidade,
// nome do arquivo/export diferente). Ver AGENTS.md deste projeto.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // .webmanifest incluído aqui (não só .png/.svg/etc) porque o manifest
    // da estação de assinatura (public/manifest-estacao.webmanifest) tem
    // que ser buscável pelo navegador do aparelho pareado ANTES de
    // qualquer contexto de autenticação — é isso que o navegador consulta
    // pra decidir se oferece "instalar app". Sem esta exceção, o pedido
    // caía na regra de baixo (não autenticado, fora de PUBLIC_PATHS) e
    // era redirecionado pra /login — o navegador recebia HTML de login no
    // lugar do JSON do manifest e nunca oferecia instalar como app de
    // verdade, então o "ícone" virava só um favorito comum que não segura
    // o pareamento entre uma abertura e outra.
    //
    // .mp4/.webm incluídos em 20/10/2026: o vídeo institucional da landing
    // page pública (public/video/morsafe-institucional.mp4) estava caindo
    // na mesma armadilha — como ".mp4" não estava nesta lista de extensões
    // isentas, o pedido do <video> era tratado como rota protegida e
    // redirecionado pra /login (confirmado: o vídeo sumia no site mesmo
    // com o arquivo já publicado certinho no GitHub). .mov incluído por
    // precaução, caso algum vídeo futuro seja exportado nesse formato.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|mp4|webm|mov)$).*)",
  ],
};
