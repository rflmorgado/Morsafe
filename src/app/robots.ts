import type { MetadataRoute } from "next";

// robots.txt do site (https://www.morsafe.com.br/robots.txt). Criado em
// 10/11/2026: sem ele o Google não tinha nenhuma orientação sobre o que
// rastrear. O que importa indexar é só o site de divulgação (raiz "/") e as
// páginas legais; as telas do app, a API e a estação de assinatura não têm
// nada pra aparecer numa busca (ou exigem login). A rota precisa estar
// isenta do middleware de sessão — ver o matcher em src/proxy.ts.
//
// Ajustado em 11/11/2026: a verificação diária agendada (que busca o site
// por uma ferramenta que RESPEITA o robots.txt) passou a ser bloqueada em
// "/entrar" e em "/api/cron/verificacao-diaria" e deixou de reportar essas
// duas checagens. Por isso essas duas rotas ficam liberadas aqui — em
// robots.txt a regra mais específica vence, então o Allow abaixo vale mesmo
// com "/api/" bloqueado. A rota de verificação continua protegida pelo
// token (HEALTH_CHECK_TOKEN), liberar o rastreamento não a deixa pública.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/entrar", "/api/cron/verificacao-diaria"],
      disallow: ["/api/", "/estacao", "/login", "/redefinir-senha"],
    },
    sitemap: "https://www.morsafe.com.br/robots.txt".replace("robots.txt", "sitemap.xml"),
    host: "https://www.morsafe.com.br",
  };
}
