import type { MetadataRoute } from "next";

// robots.txt do site (https://www.morsafe.com.br/robots.txt). Criado em
// 10/11/2026: sem ele o Google não tinha nenhuma orientação sobre o que
// rastrear. O que importa indexar é só o site de divulgação (raiz "/") e as
// páginas legais; as telas do app, a API e a estação de assinatura não têm
// nada pra aparecer numa busca (ou exigem login). A rota precisa estar
// isenta do middleware de sessão — ver o matcher em src/proxy.ts.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/estacao", "/entrar", "/login", "/redefinir-senha"],
    },
    sitemap: "https://www.morsafe.com.br/sitemap.xml",
    host: "https://www.morsafe.com.br",
  };
}
