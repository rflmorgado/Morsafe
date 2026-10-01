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

function normalizarNomeEpi(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

type RegraClassificacao = {
  tipo: (typeof TIPOS_EPI)[number];
  palavras: string[];
};

// Ordem importa: a primeira regra cujas palavras batem com o nome vence —
// por isso as mais específicas (ex.: "protetor de pele", que é mão/pele,
// não rosto) vêm antes das mais genéricas. Palavras já sem acento, porque
// normalizarNomeEpi() tira os acentos do nome antes de comparar.
const REGRAS_CLASSIFICACAO: RegraClassificacao[] = [
  {
    tipo: "Proteção auditiva",
    palavras: ["protetor auricular", "auricular", "abafador", "plug auditivo"],
  },
  {
    tipo: "Proteção visual",
    palavras: ["oculos", "viseira", "protetor facial", "face shield"],
  },
  {
    tipo: "Proteção respiratória",
    palavras: ["respirador", "mascara", "filtro", "pff", "semifacial"],
  },
  {
    tipo: "Proteção das mãos",
    palavras: ["luva", "luvas", "creme protetor", "protetor de pele"],
  },
  {
    tipo: "Proteção dos pés",
    palavras: ["calcado", "bota", "botina", "sapato"],
  },
  {
    tipo: "Proteção contra quedas",
    palavras: ["cinto de seguranca", "cinturao", "talabarte", "trava-quedas", "trava quedas"],
  },
  {
    tipo: "Proteção térmica",
    palavras: ["termic", "anti-chama", "antichama", "aluminizad"],
  },
  {
    tipo: "Proteção da cabeça",
    palavras: ["capacete", "balaclava", "touca", "capuz"],
  },
  {
    tipo: "Proteção do corpo",
    palavras: [
      "macacao",
      "avental",
      "blusao",
      "jaleco",
      "colete",
      "mangote",
      "capa de chuva",
      "uniforme",
    ],
  },
];

/**
 * Classificação automática de Tipo a partir do NOME do EPI, por
 * palavra-chave — usa a mesma lista fixa TIPOS_EPI acima. Pedido do Rafael
 * depois de notar que a importação combinada de catálogo + estoque
 * (estoque/importar-catalogo-estoque-button.tsx) deixava o Tipo em branco
 * quando a planilha não tinha uma coluna de Tipo já preenchida — ele
 * esperava que funcionasse sozinho a partir do nome, como lembrava de uma
 * vez anterior.
 *
 * Usada como reserva (fallback) sempre que um EPI é criado/editado sem um
 * tipo explícito: cadastro manual com o campo deixado em branco, planilha
 * sem a coluna "Tipo" mapeada ou com a célula vazia, e no backfill em lote
 * de itens já cadastrados sem tipo (ver classificarTiposFaltantes em
 * epis/actions.ts). Nunca sobrescreve um tipo que já foi informado — só
 * preenche o que, de outro jeito, ficaria em branco.
 *
 * É uma classificação por palavra-chave, não um laudo técnico: cobre os
 * casos mais comuns, mas pode errar em nomes fora do padrão (ex.: uma sigla
 * ou nome comercial sem nenhuma palavra reconhecida) — por isso o campo
 * Tipo continua editável normalmente depois, pra revisão humana. Retorna
 * null quando nada bate, deixando o EPI sem tipo (igual a hoje).
 */
export function classificarTipoEpi(nome: string): string | null {
  const nomeNormalizado = normalizarNomeEpi(nome);
  if (!nomeNormalizado) return null;

  for (const regra of REGRAS_CLASSIFICACAO) {
    if (regra.palavras.some((palavra) => nomeNormalizado.includes(palavra))) {
      return regra.tipo;
    }
  }
  return null;
}
