import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/redefinir-senha",
  "/politica-de-privacidade",
  "/seguranca-da-informacao",
  // Tela do aparelho pareado (tablet/celular da empresa fixado num ponto de
  // coleta) e o link de pareamento — quem abre isso nunca está logado no
  // MorSafe como usuário, só autenticado pelo token da própria estação (ver
  // src/app/estacao/actions.ts). Sem essa exceção, o middleware redirecionava
  // pra /login e a estação nunca conseguia carregar.
  "/estacao",
  // Página pública de verificação de documento (ver ficha/route.ts e
  // lib/data/verificacao-documento.ts) — um juiz, auditor ou perito abrindo
  // o link/código impresso no rodapé de uma Ficha de EPI nunca tem login no
  // MorSafe.
  "/verificar",
];

/**
 * Atualiza a sessão do Supabase Auth a cada request e redireciona para
 * /login quem não estiver autenticado (exceto nas rotas públicas).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Usuário desativado (ver src/app/(app)/usuarios) não pode continuar
  // usando o app mesmo com uma sessão do Supabase Auth ainda válida — sem
  // essa checagem, "ativo" na tabela `usuarios` não bloqueava nada de
  // verdade. Isso cobre o uso normal do app; não é o mesmo que revogar
  // acesso direto via API/RLS (fora do escopo desta checagem).
  //
  // Mesma lógica agora pra `empresas.ativo` (ver app/(app)/empresas) — sem
  // isso, desativar uma empresa na tela de administração do super_admin só
  // mudava um rótulo na tela, sem bloquear nada de verdade. O embed
  // `empresas ( ativo )` funciona nesse sentido porque `usuarios.empresa_id`
  // é quem declara a FK (ver comentário no topo de database.ts). Pra
  // super_admin (sem empresa_id) o embed vem null, então empresaAtiva fica
  // undefined — nunca bloqueia esse papel.
  if (user && !isPublicPath) {
    const { data: perfil } = await supabase
      .from("usuarios")
      .select("ativo, ultima_atividade, empresas ( ativo )")
      .eq("id", user.id)
      .maybeSingle();

    const empresaAtiva = (
      perfil?.empresas as unknown as { ativo: boolean } | null
    )?.ativo;

    if (perfil && perfil.ativo === false) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("motivo", "acesso_desativado");
      return NextResponse.redirect(url);
    }

    if (perfil && empresaAtiva === false) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("motivo", "empresa_desativada");
      return NextResponse.redirect(url);
    }

    // Marca "última atividade" pra bolinha de presença em /usuarios
    // (verde/laranja/vermelho). Throttle de 1 minuto — só grava de novo se
    // a marcação anterior já tiver essa idade, pra não fazer um UPDATE a
    // cada request nas telas do app.
    const ultimaAtividadeMs = perfil?.ultima_atividade
      ? new Date(perfil.ultima_atividade).getTime()
      : 0;
    if (Date.now() - ultimaAtividadeMs > 60_000) {
      await supabase
        .from("usuarios")
        .update({ ultima_atividade: new Date().toISOString() })
        .eq("id", user.id);
    }
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
