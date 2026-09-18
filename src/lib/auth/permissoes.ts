import type { PapelUsuario } from "@/types/database";

/**
 * Hierarquia de papéis dentro de uma empresa cliente: leitura < encarregado
 * < admin < super_admin. super_admin nunca pertence a uma empresa (é dono
 * do MorSafe, ver comentário em database.ts), então na prática só
 * leitura/encarregado/admin operam nas telas de uma empresa — mas ele fica
 * no topo da hierarquia por completude.
 */
const NIVEL: Record<PapelUsuario, number> = {
  leitura: 0,
  encarregado: 1,
  admin: 2,
  super_admin: 3,
};

/**
 * true se o papel do usuário atinge (ou supera) o nível mínimo exigido para
 * uma ação. Usado tanto nas Server Actions/rotas (barreira de verdade) quanto
 * nas telas (pra decidir o que mostrar) — mas nunca confiar só na tela: o
 * botão pode não aparecer, porém quem chamar a action/rota direto também
 * precisa ser barrado aqui.
 */
export function temPapelMinimo(
  papel: PapelUsuario | null | undefined,
  minimo: PapelUsuario,
): boolean {
  if (!papel) return false;
  return NIVEL[papel] >= NIVEL[minimo];
}
