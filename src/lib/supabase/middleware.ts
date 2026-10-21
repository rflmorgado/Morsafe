import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  // Tela de boas-vindas do app, antes do login (ver src/app/entrar/page.tsx)
  // — a pedido do Rafael (19/10/2026), diferente da landing page pública de
  // divulgação em "/".
  "/entrar",
  "/redefinir-senha",
  "/politica-de-privacidade",
  "/seguranca-da-informacao",
  "/termos-de-uso",
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
  // Toda a API (webhooks/asaas, cron/verificar-inadimplencia) roda sem
  // sessão do Supabase por design — cada uma se autentica com seu próprio
  // token (ASAAS_WEBHOOK_TOKEN / CRON_SECRET, ver comentário de cada
  // route.ts), nunca por cookie de login. Sem esta exceção, toda chamada
  // batia aqui primeiro e era redirecionada (307) pra /login antes mesmo
  // de chegar na checagem de token da rota — foi assim que a Vercel
  // registrou "POST /api/webhooks/asaas → 307 /login" em 15/10/2026: o
  // Asaas mandava o evento de pagamento certinho e o MorSafe nunca
  // processava, porque a notificação nem chegava no handler (ver route.ts
  // de cada uma — NENHUMA dessas rotas espera usuário logado).
  "/api",
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

  // "/" (a landing page pública, fora do grupo (app)) é pública só na raiz
  // exata — nunca via startsWith, porque toda rota do sistema começa com
  // "/" e isso liberaria o app inteiro para quem não está logado.
  const isPublicPath =
    request.nextUrl.pathname === "/" ||
    PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

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
    // nome/papel/empresa_id e empresas.nome foram adicionados a este select
    // em 21/10/2026 (antes só vinha ativo/ultima_atividade/empresas.ativo/
    // assinaturas.status) — não é uma consulta nova, é a MESMA consulta já
    // paga aqui embaixo, só pedindo mais colunas dela. O motivo: esse é
    // exatamente o mesmo perfil que getCurrentUser() (current-user.ts) ia
    // buscar de novo, do zero, a cada navegação — repetindo tanto o
    // auth.getUser() quanto este select. Ver o bloco de headers logo
    // abaixo, que repassa esse resultado pro resto do request em vez de
    // deixar getCurrentUser() buscar tudo de novo.
    const { data: perfil, error: perfilError } = await supabase
      .from("usuarios")
      .select(
        "nome, papel, empresa_id, ativo, ultima_atividade, empresas ( nome, ativo, assinaturas ( status ) )",
      )
      .eq("id", user.id)
      .maybeSingle();

    const empresaEmbed = perfil?.empresas as unknown as {
      nome: string;
      ativo: boolean;
      assinaturas: { status: string }[] | { status: string } | null;
    } | null;
    const empresaAtiva = empresaEmbed?.ativo;
    // O embed vem array (join 1:N do ponto de vista do schema, mesmo
    // `assinaturas` tendo índice único por empresa_id garantindo 1:1 na
    // prática) ou objeto único dependendo da versão do PostgREST — trata
    // os dois formatos. `assinaturas` já existe em produção desde a
    // migração pro Supabase novo (16/10/2026, ver morsafe-schema.sql) —
    // pra uma empresa sem assinatura cadastrada ainda (ex.: recém-criada,
    // antes de `criarEmpresa` terminar) o embed vem vazio/null, e
    // `statusAssinatura` fica `undefined`, que nunca bate com "suspensa"
    // no bloqueio logo abaixo — não trava ninguém por engano.
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

    // Repassa o perfil já buscado aqui em cima pro resto do request via
    // headers — pedido do Rafael, 21/10/2026 ("transições de tela e salvar
    // estão demorando"): sem isso, getCurrentUser() (current-user.ts),
    // chamada em todo Server Component protegido e em toda Server Action
    // (que também passa por este middleware), refazia do ZERO o MESMO
    // auth.getUser() + select em usuarios que acabamos de fazer acima — 2
    // idas-e-voltas ao Supabase a mais em CADA navegação e em CADA
    // salvamento, uma delas validando o token no servidor de Auth (a mais
    // lenta das duas). getCurrentUser() lê esses headers primeiro e só cai
    // de volta pra buscar do banco se, por algum motivo, eles não
    // existirem (rede de segurança, não o caminho normal).
    //
    // `new Headers(request.headers)` clona os headers que o CLIENTE mandou
    // antes de sobrescrever os nomes abaixo — isso é o que garante que um
    // request malicioso não consiga simplesmente mandar
    // "x-morsafe-user-papel: admin" por fora: qualquer valor que o cliente
    // tenha mandado pra esses nomes é substituído aqui pelo valor validado
    // no servidor, e só o QUE SOBRA depois dessa substituição é o que
    // getCurrentUser() consegue ler. encodeURIComponent no nome/empresa
    // evita que um acento ou caractere fora do padrão ASCII quebre o
    // header (nomes de pessoa/empresa não são garantidos ASCII puro).
    if (perfil) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-morsafe-user-id", user.id);
      requestHeaders.set(
        "x-morsafe-user-email",
        encodeURIComponent(user.email ?? ""),
      );
      requestHeaders.set(
        "x-morsafe-user-nome",
        encodeURIComponent(perfil.nome ?? ""),
      );
      requestHeaders.set("x-morsafe-user-papel", perfil.papel);
      requestHeaders.set("x-morsafe-empresa-id", perfil.empresa_id ?? "");
      requestHeaders.set(
        "x-morsafe-empresa-nome",
        encodeURIComponent(empresaEmbed?.nome ?? ""),
      );

      const respostaComHeaders = NextResponse.next({
        request: { headers: requestHeaders },
      });
      // NextResponse.next() cria uma resposta NOVA, sem os cookies de
      // sessão que o bloco de cookies lá em cima já pode ter definido em
      // `supabaseResponse` (refresh do Supabase Auth) — copia o que já
      // existe antes de trocar qual resposta o middleware devolve.
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        respostaComHeaders.cookies.set(cookie);
      });
      supabaseResponse = respostaComHeaders;
    }
  }

  // Usuário já logado não precisa ver a tela de boas-vindas nem o login —
  // vai direto pro painel. IMPORTANTE: "/" (a landing page pública de
  // divulgação, morsafe.com.br) fica de fora de propósito, a pedido do
  // Rafael (19/10/2026) — "a tela do app não tem vínculo com o nosso
  // domínio morsafe.com.br". O site público é pra divulgação, mostrado
  // sempre, pra qualquer visitante, logado ou não; ele nunca entra no app
  // sozinho — só clicando em "Entrar" (que aí sim passa por "/entrar" e
  // "/login", onde o redirecionamento abaixo continua valendo).
  if (
    user &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/entrar")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
