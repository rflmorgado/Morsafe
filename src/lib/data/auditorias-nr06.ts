import { createClient } from "@/lib/supabase/server";
import type { AuditoriaNr06, RespostasAuditoria } from "./auditorias-nr06-perguntas";
import { contarNaoConformidades } from "./auditorias-nr06-perguntas";

export type {
  AuditoriaNr06,
  ChavePerguntaAuditoria,
  RespostasAuditoria,
} from "./auditorias-nr06-perguntas";
export {
  PERGUNTAS_AUDITORIA_NR06,
  contarNaoConformidades,
} from "./auditorias-nr06-perguntas";

type LinhaAuditoria = {
  id: string;
  setor_id: string;
  data: string;
  responsavel: string;
  observacoes: string | null;
  criado_em: string;
  p1_eficaz: boolean | null;
  p2_protecao_coletiva_tentada: boolean | null;
  p3_uso_ininterrupto: boolean | null;
  p4_ajustado_campo: boolean | null;
  p5_ca_validado_na_compra: boolean | null;
  p6_periodicidade_troca: boolean | null;
  p7_higienizacao: boolean | null;
  p8_manutencao: boolean | null;
};

// `as const` preserva o tipo literal da string — sem isso, o Supabase não
// consegue inferir o formato exato da linha retornada por `.select()` (caía
// pra um tipo genérico demais) a partir de uma constante do tipo `string`.
const COLUNAS_AUDITORIA =
  "id, setor_id, data, responsavel, observacoes, criado_em, p1_eficaz, p2_protecao_coletiva_tentada, p3_uso_ininterrupto, p4_ajustado_campo, p5_ca_validado_na_compra, p6_periodicidade_troca, p7_higienizacao, p8_manutencao" as const;

function linhaParaAuditoria(row: LinhaAuditoria): AuditoriaNr06 {
  const respostas: RespostasAuditoria = {
    p1_eficaz: row.p1_eficaz,
    p2_protecao_coletiva_tentada: row.p2_protecao_coletiva_tentada,
    p3_uso_ininterrupto: row.p3_uso_ininterrupto,
    p4_ajustado_campo: row.p4_ajustado_campo,
    p5_ca_validado_na_compra: row.p5_ca_validado_na_compra,
    p6_periodicidade_troca: row.p6_periodicidade_troca,
    p7_higienizacao: row.p7_higienizacao,
    p8_manutencao: row.p8_manutencao,
  };

  return {
    id: row.id,
    setorId: row.setor_id,
    data: row.data,
    responsavel: row.responsavel,
    observacoes: row.observacoes,
    criadoEm: row.criado_em,
    respostas,
  };
}

export type SetorComStatusAuditoria = {
  id: string;
  nome: string;
  ultimaAuditoria: AuditoriaNr06 | null;
};

// Prazo de referência pra sinalizar que a auditoria de campo (checklist) de
// um setor está desatualizada e merece ser refeita — pedido do Rafael,
// 06/10/2026. A NR-06 em si NÃO fixa periodicidade pra esse checklist (só
// define obrigações de fornecer/orientar/registrar entrega, ver comentário
// no topo de lib/data/auditoria-registros.ts) — 12 meses é o ciclo mínimo de
// revisão do PGR sob a NR-01 (gerenciamento de risco, do qual o uso de EPI é
// um controle), adotado aqui como referência prática mais comum entre
// empresas, não como exigência normativa fechada. Nada impede rodar a
// auditoria antes disso — o alerta é só um lembrete de que já passou o
// prazo "padrão" de revisão, igual é explicado nas telas (ver
// checklist-campo-tab.tsx e auditoria/relatorio/route.ts).
export const REVISAO_AUDITORIA_MESES = 12;
const REVISAO_AUDITORIA_DIAS = 365; // ~12 meses
const DIA_MS = 24 * 60 * 60 * 1000;

export type SituacaoAuditoriaSetor =
  | "nunca_auditado"
  | "pendente"
  | "vencida"
  | "conforme";

/**
 * Situação de UM setor em relação ao checklist de campo, cruzando duas
 * coisas independentes: se a última auditoria encontrou alguma
 * não-conformidade (campo pendente, sempre o mais urgente, não importa a
 * data) e se já passou do prazo de revisão (REVISAO_AUDITORIA_DIAS) mesmo
 * sem nenhuma não-conformidade registrada (setor "vencido" — já era
 * conforme, mas pede uma nova olhada). Centralizado aqui (em vez de
 * recalculado em cada tela) pra garantir que checklist-campo-tab.tsx e o
 * Relatório em PDF (auditoria/relatorio/route.ts) nunca divirjam no que
 * conta como "vencido".
 */
export function calcularSituacaoAuditoriaSetor(
  ultimaAuditoria: AuditoriaNr06 | null,
): SituacaoAuditoriaSetor {
  if (!ultimaAuditoria) return "nunca_auditado";
  if (contarNaoConformidades(ultimaAuditoria.respostas) > 0) return "pendente";
  const diasDesde = Math.floor(
    (Date.now() - new Date(`${ultimaAuditoria.data}T00:00:00`).getTime()) /
      DIA_MS,
  );
  return diasDesde > REVISAO_AUDITORIA_DIAS ? "vencida" : "conforme";
}

/**
 * Todos os setores da empresa, cada um com a sua auditoria mais recente (se
 * houver). Não existe uma "view" de última-auditoria-por-setor no banco —
 * com poucas dezenas de setores por empresa e uma auditoria rodando no
 * máximo com frequência mensal/trimestral na prática, é mais simples trazer
 * o histórico inteiro da empresa de uma vez (uma só consulta, sem N+1) e
 * escolher a mais recente de cada setor aqui, do que criar uma view só pra
 * isso — se o volume crescer muito, dá pra revisitar.
 */
export async function listSetoresComStatusAuditoria(
  empresaId: string | null,
): Promise<SetorComStatusAuditoria[]> {
  if (!empresaId) return [];

  const supabase = await createClient();

  const [
    { data: setores, error: setoresError },
    { data: auditorias, error: auditoriasError },
  ] = await Promise.all([
    supabase
      .from("setores")
      .select("id, nome")
      .eq("empresa_id", empresaId)
      .order("nome", { ascending: true }),
    supabase
      .from("auditorias_nr06")
      .select(COLUNAS_AUDITORIA)
      .eq("empresa_id", empresaId)
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false }),
  ]);

  if (setoresError || !setores) {
    console.error(
      "listSetoresComStatusAuditoria (setores):",
      setoresError?.message,
    );
    return [];
  }
  if (auditoriasError) {
    console.error(
      "listSetoresComStatusAuditoria (auditorias):",
      auditoriasError.message,
    );
  }

  // Já vem ordenado por data/criado_em decrescente, então a primeira
  // ocorrência de cada setor_id encontrada aqui já é a mais recente — não
  // precisa reordenar nada em memória.
  const ultimaPorSetor = new Map<string, AuditoriaNr06>();
  for (const row of auditorias ?? []) {
    if (!ultimaPorSetor.has(row.setor_id)) {
      ultimaPorSetor.set(row.setor_id, linhaParaAuditoria(row));
    }
  }

  return setores.map((s) => ({
    id: s.id,
    nome: s.nome,
    ultimaAuditoria: ultimaPorSetor.get(s.id) ?? null,
  }));
}

/**
 * Histórico completo de auditorias de UM setor, mais recente primeiro —
 * usado na tela de detalhe (/auditoria/[setorId]). Confirma a posse do
 * setor (nome + empresa_id) na mesma função, pra tela poder mostrar "Setor
 * não encontrado" (notFound()) sem precisar de uma segunda ida ao banco —
 * mesmo padrão de getColaboradorDetalhe, em colaboradores.ts.
 */
export async function getSetorComHistoricoAuditoria(
  empresaId: string | null,
  setorId: string,
): Promise<{
  setor: { id: string; nome: string };
  auditorias: AuditoriaNr06[];
} | null> {
  if (!empresaId) return null;

  const supabase = await createClient();

  const { data: setor, error: setorError } = await supabase
    .from("setores")
    .select("id, nome, empresa_id")
    .eq("id", setorId)
    .maybeSingle();

  if (setorError || !setor || setor.empresa_id !== empresaId) {
    return null;
  }

  const { data: auditorias, error: auditoriasError } = await supabase
    .from("auditorias_nr06")
    .select(COLUNAS_AUDITORIA)
    .eq("empresa_id", empresaId)
    .eq("setor_id", setorId)
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false });

  if (auditoriasError) {
    console.error("getSetorComHistoricoAuditoria:", auditoriasError.message);
  }

  return {
    setor: { id: setor.id, nome: setor.nome },
    auditorias: (auditorias ?? []).map(linhaParaAuditoria),
  };
}

/**
 * Total de EPIs com C.A. vencendo em até 30 dias, pro card de resumo do
 * topo de /auditoria — mesma view (`vw_ca_vencendo`) que já alimenta o
 * card de C.A. vencendo do Dashboard (ver lib/data/dashboard.ts), só que
 * aqui só a contagem (head: true), sem trazer as linhas.
 */
export async function countCaVencendo(empresaId: string | null): Promise<number> {
  if (!empresaId) return 0;

  const supabase = await createClient();

  const { count, error } = await supabase
    .from("vw_ca_vencendo")
    .select("epi_id", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  if (error) {
    console.error("countCaVencendo:", error.message);
    return 0;
  }

  return count ?? 0;
}
