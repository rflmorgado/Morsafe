import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renomeou middleware.ts -> proxy.ts (mesma funcionalidade,
// nome do arquivo/export diferente). Ver AGENTS.md deste projeto.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // "api" excluído em 27/10/2026: toda rota em /api/* tem autenticação
    // PRÓPRIA (token no header, nunca sessão do Supabase) — o webhook do
    // Asaas (asaas-access-token), o cron de inadimplência (Authorization:
    // Bearer CRON_SECRET) e o chat da Mora (deliberadamente público, sem
    // login nenhum). Sem esta exceção, QUALQUER chamada a /api/* sem uma
    // sessão de usuário logado (ou seja, toda chamada de verdade, já que
    // quem chama nunca é alguém logado no MorSafe) caía na regra de baixo
    // e era redirecionada pra /login com 307 — a rota de API em si nunca
    // chegava a rodar. Descoberto quando o Asaas reportou erro 307 ao
    // tentar entregar um webhook de pagamento; confirmado que o mesmo
    // bug também bloqueava o cron de inadimplência e o chat da Mora pro
    // visitante sem login. Cada rota de /api/* continua responsável pela
    // própria autenticação — isso só tira o middleware de sessão do
    // caminho delas.
    //
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
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|mp4|webm|mov)$).*)",
  ],
};
