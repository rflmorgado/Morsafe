// Formato compartilhado do campo "itens" que viaja (como JSON, dentro de um
// único campo de FormData) entre o formulário de Registrar entrega
// (registrar-entrega-button.tsx) e a Server Action que grava no banco
// (registrarEntrega, em actions.ts).
//
// Criado depois da falha de 26/10/2026 ("Itens da entrega inválidos"): o
// botão foi reescrito e parou de mandar esse campo no formato que a action
// esperava, e como cada lado tinha seu próprio JSON.stringify/JSON.parse
// solto, o descompasso não apareceu em lugar nenhum até travar pra um
// cliente de verdade (ver CLAUDE.md, regra 9). Ao os dois lados importarem
// as MESMAS funções deste arquivo em vez de montar/ler o JSON cada um do
// seu jeito, uma mudança de formato num lado só deixa de quebrar quietamente
// se o outro lado também for atualizado — e como os dois importam o mesmo
// arquivo, isso fica visível (import não usado, erro de tipo) em vez de
// silencioso.
//
// Regra 9 do CLAUDE.md: ao tocar em QUALQUER coisa aqui, reler os dois
// lugares que importam este arquivo (registrar-entrega-button.tsx e
// actions.ts) antes de considerar a mudança pronta.

export type ItemEntregaPayload = {
  epi_id: string;
  motivo: string;
  quantidade: number;
};

/** Usado pelo botão ao montar o FormData, nos dois modos de confirmação
 * (assinatura local e coleta na estação). */
export function serializarItensEntrega(itens: ItemEntregaPayload[]): string {
  return JSON.stringify(itens);
}

/**
 * Usado por registrarEntrega() ao ler o FormData. Devolve `null` quando o
 * campo não é um JSON válido de array (campo ausente, string vazia, ou
 * formato quebrado) — quem chama decide a mensagem de erro; este arquivo
 * não sabe sobre UI. Validação campo a campo (epi_id/motivo/quantidade
 * vazios ou inválidos) continua em actions.ts, que já lida com isso linha a
 * linha pra apontar qual item especificamente está incompleto.
 */
export function parseItensEntrega(raw: string): ItemEntregaPayload[] | null {
  if (!raw) return null;
  let bruto: unknown;
  try {
    bruto = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(bruto)) return null;
  return bruto as ItemEntregaPayload[];
}
