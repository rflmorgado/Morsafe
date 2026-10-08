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
    const { data: perfil, error: perfilError } = await supabase
      .from("usuarios")
      .select(
        "ativo, ultima_atividade, empresas ( ativo, assinaturas ( status ) )",
      )
      .eq("id", user.id)
      .maybeSingle();

    const empresaEmbed = perfil?.empresas as unknown as {
      ativo: boolean;
      assinaturas: { status: string }[] | { status: string } | null;
    } | null;
    const empresaAtiva = empresaEmbed?.ativo;
    // O embed vem array (join 1:N do ponto de vista do schema, mesmo
    // `assinaturas` tendo índice único por empresa_id garantindo 1:1 na
    // prática) ou objeto único dependendo da versão do PostgREST — trata
    // os dois formatos. `assinaturas` ainda não existe em produção (ver
    // morsafe-add-assinaturas-asaas.sql, pendente) — até lá o embed
    // sempre vem vazio/null e nenhuma empresa é bloqueada por isso.
    const statusAssinatura = Array.isArray(empresaEmbed?.assinaturas)
      ? empresaEmbed?.assinaturas[0]?.status
      : empresaEmbed?.assinaturas?.status;

    // Autenticado no Supabase Auth mas sem linha correspondente em
    // `usuarios` (e sem erro de consulta — só ausência real do registro,
    // não uma falha transitória de rede/banco, que não deve bloquear
    // ninguém): acontece se a exclusão de um login (ver
    // excluirUsuarioDefinitivamente/excluirEmpresaPermanentemente, em
    // usuarios/actions.ts e empresas/actions.ts) apagar a linha em
    // `usuarios` mas falhar ao apagar o login em auth.users — esse login
    // continuava autenticável e passava por aqui sem perfil nenhum (fica
    // só com o default de getCurrentUser: papel "leitura", empresaId
    // null). Fail-closed: nega acesso em vez de deixar passar sem perfil
    // (ver auditoria de isolamento entre empresas, 06/10/2026).
    if (!perfil && !perfilError) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("motivo", "acesso_desativado");
      return NextResponse.redirect(url);
    }

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

    // Régua de inadimplência (ver MorSafe_Modelo_Comercial_e_Fluxo_de_Cobranca):
    // assinatura em atraso além do prazo de tolerância vira "suspensa" (ver
    // job em app/api/cron/verificar-inadimplencia/route.ts) e bloqueia o
    // acesso operacional da empresa — sem isso, "suspensa" não significava
    // nada de verdade, igual "empresaAtiva" antes do bloqueio acima. Não
    // confundir com empresaAtiva === false (desativação manual pelo
    // super_admin): aqui é consequência automática de inadimplência.
    if (perfil && statusAssinatura === "suspensa") {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("motivo", "assinatura_suspensa");
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
