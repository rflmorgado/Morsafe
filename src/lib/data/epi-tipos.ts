/**
 * Categorias padronizadas de EPI (agrupadas pela parte do corpo protegida,
 * como no protótipo aprovado). Mantidas como lista fixa — com opção "Outro"
 * nos formulários para o caso raro de não se encaixar — para os filtros e
 * relatórios futuros não quebrarem por causa de "Mãos" vs "Mão" vs "Luvas".
 *
 * Fica num arquivo separado de epis.ts (que importa @/lib/supabase/server,
 * só pode rodar no servidor) porque componentes cliente como os filtros e o
 * formulário de EPI também precisam dessa lista — importar de epis.ts
 * puxaria o cliente Supabase de servidor pro bundle do navegador.
 */
export const TIPOS_EPI = [
  "Proteção da cabeça",
  "Proteção auditiva",
  "Proteção visual",
  "Proteção respiratória",
  "Proteção das mãos",
  "Proteção dos pés",
  "Proteção do corpo",
  "Proteção contra quedas",
  "Proteção térmica",
] as const;
