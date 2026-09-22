import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/redefinir-senha"];

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
  if (user && !isPublicPath) {
    const { data: perfil } = await supabase
      .from("usuarios")
      .select("ativo")
      .eq("id", user.id)
      .maybeSingle();

    if (perfil && perfil.ativo === false) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("motivo", "acesso_desativado");
      return NextResponse.redirect(url);
    }
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
