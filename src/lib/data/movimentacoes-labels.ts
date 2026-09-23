import type {
  MotivoEntrega,
  MotivoDevolucao,
  DestinoDevolucao,
} from "@/types/database";

// Rótulos e tipos puros (sem tocar Supabase/next/headers), separados de
// movimentacoes.ts pra poder ser importados direto por componentes cliente
// — mesma ideia de epi-tipos.ts em relação a epis.ts (ver comentário lá).
// Importar qualquer coisa de movimentacoes.ts num componente cliente
// arrasta createClient()/next/headers pro bundle do navegador e quebra o
// build ("You're importing a module that depends on next/headers...").

export type TipoMovimentacao = "entrega" | "devolucao" | "recusa";

export const MOTIVO_ENTREGA_LABEL: Record<MotivoEntrega, string> = {
  primeira_entrega: "Primeira entrega",
  troca_desgaste: "Troca por desgaste",
  troca_dano: "Troca por dano",
  perda: "Perda",
  roubo: "Roubo",
  vencimento_vida_util: "Vencimento da vida útil",
  vencimento_ca: "Vencimento do C.A.",
};

export const MOTIVO_DEVOLUCAO_LABEL: Record<MotivoDevolucao, string> = {
  troca: "Troca",
  desligamento: "Desligamento",
  mudanca_funcao: "Mudança de função",
  extraviado_nao_devolvido: "Extraviado (não devolvido)",
};

export const DESTINO_DEVOLUCAO_LABEL: Record<DestinoDevolucao, string> = {
  descarte: "Descarte",
  reaproveitamento: "Reaproveitamento",
  nao_aplicavel: "Não aplicável",
};
