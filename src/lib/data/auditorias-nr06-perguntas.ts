/**
 * As 8 perguntas oficiais do checklist de auditoria de NR-06, na mesma
 * ordem das colunas de `auditorias_nr06` (ver morsafe-schema.sql, seção
 * "12. AUDITORIA NR-06") — fonte única usada tanto pelo formulário
 * (auditoria/rodar-auditoria-button.tsx) quanto pela tela de histórico
 * (auditoria/[setorId]/page.tsx), pra nunca ter o texto de uma pergunta
 * divergindo entre as duas telas.
 *
 * Este arquivo é separado de lib/data/auditorias-nr06.ts DE PROPÓSITO: ele
 * não importa nada do Supabase (createClient depende de next/headers, que
 * só pode rodar no servidor) — assim o formulário, que é Client Component
 * (precisa de useState/useTransition pro modal), pode importar as perguntas
 * e o tipo de resposta sem puxar o cliente do servidor do Supabase pro
 * bundle do navegador. Foi exatamente esse erro que o build acusou na
 * primeira versão (`next/headers` importado num Client Component) antes de
 * separar este arquivo.
 */
export const PERGUNTAS_AUDITORIA_NR06 = [
  {
    chave: "p1_eficaz",
    pergunta: "O EPI é eficaz para o risco a que se destina?",
  },
  {
    chave: "p2_protecao_coletiva_tentada",
    pergunta:
      "Foi avaliada e tentada a proteção coletiva antes de recorrer ao EPI?",
  },
  {
    chave: "p3_uso_ininterrupto",
    pergunta:
      "O uso é garantido de forma ininterrupta durante toda a exposição ao risco?",
  },
  {
    chave: "p4_ajustado_campo",
    pergunta:
      "O EPI está ajustado ao colaborador em campo, sem folgas que comprometam a proteção?",
  },
  {
    chave: "p5_ca_validado_na_compra",
    pergunta: "O C.A. foi validado no momento da compra?",
  },
  {
    chave: "p6_periodicidade_troca",
    pergunta: "A periodicidade de troca definida está sendo cumprida?",
  },
  {
    chave: "p7_higienizacao",
    pergunta: "A higienização está sendo feita conforme orientação do fabricante?",
  },
  {
    chave: "p8_manutencao",
    pergunta: "A manutenção periódica está em dia?",
  },
] as const;

export type ChavePerguntaAuditoria =
  (typeof PERGUNTAS_AUDITORIA_NR06)[number]["chave"];

export type RespostasAuditoria = Record<ChavePerguntaAuditoria, boolean | null>;

export type AuditoriaNr06 = {
  id: string;
  setorId: string;
  data: string;
  responsavel: string;
  observacoes: string | null;
  respostas: RespostasAuditoria;
  criadoEm: string;
};

/**
 * Quantas das 8 perguntas vieram "Não" nesta auditoria — a métrica usada
 * pra sinalizar pendência tanto na listagem (/auditoria) quanto no
 * histórico por setor (/auditoria/[setorId]). "Não avaliado"/"não se
 * aplica" (null) nunca conta como pendência — só uma resposta explícita
 * "Não" conta.
 */
export function contarNaoConformidades(respostas: RespostasAuditoria): number {
  return PERGUNTAS_AUDITORIA_NR06.filter((p) => respostas[p.chave] === false)
    .length;
}
