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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
};
