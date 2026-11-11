import type { MetadataRoute } from "next";

// sitemap.xml do site (https://www.morsafe.com.br/sitemap.xml). Criado em
// 10/11/2026 pra dizer ao Google, de forma explícita, que a raiz "/" é o
// site de divulgação (e não mais a tela de login, como era até 22/10/2026
// — foto antiga que ainda aparece nos resultados de busca). Só lista
// páginas públicas; a rota precisa estar isenta do middleware de sessão
// (ver o matcher em src/proxy.ts).
const BASE_URL = "https://www.morsafe.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/tour`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/demo`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/termos-de-uso`, changeFrequency: "yearly", priority: 0.3 },
    {
      url: `${BASE_URL}/politica-de-privacidade`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/seguranca-da-informacao`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
