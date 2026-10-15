"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/data/current-user";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";
import {
  criarClienteAsaas,
  criarAssinaturaAsaas,
  criarCobrancaAvulsaAsaas,
  AsaasError,
} from "@/lib/asaas/client";
import {
  PLANO_VALOR_MENSAL,
  PLANO_LIMITE_COLABORADORES,
  TAXA_IMPLANTACAO,
} from "@/lib/data/planos";
import type { PlanoAssinatura } from "@/types/database";

export type CriarEmpresaState = {
  error: string | null;
  success?: boolean;
  // Aviso não-bloqueante: a empresa E a assinatura recorrente foram
  // criadas com sucesso (inclusive no Asaas), mas a taxa de implantação
  // (passo 5, abaixo) falhou ao ser lançada automaticamente. Diferente de
  // `error`, isto nunca impede o cadastro de ser considerado concluído —
  // só avisa o super_admin pra lançar manualmente via "+ Novo pagamento".
  avisoImplantacao?: string;
};

const PLANOS_COMERCIAIS = new Set<string>([
  "start",
  "essencial",
  "profissional",
  "empresa",
  "industrial",
  "enterprise",
]);

/**
 * Vencimento da taxa de implantação: hoje + 7 dias corridos, nunca o
 * próprio dia do cadastro. A implantação (estrutura, colaboradores, EPIs,
 * estoque, treinar o primeiro usuário) não é instantânea — prometemos ao
 * cliente até 5 dias úteis pra isso — e cobrar no mesmo dia do cadastro
 * cobraria antes da empresa estar de fato funcionando. 7 dias corridos dá
 * folga além dos 5 dias úteis prometidos mesmo com fim de semana no meio,
 * sem precisar de um status novo de "implantação concluída": a régua
 * continua 100% automática, só com um prazo fixo em vez de "hoje".
 */
function vencimentoTaxaImplantacao(): string {
  const data = new Date();
  data.setDate(data.getDate() + 7);
  return data.toISOString().slice(0, 10);
}

/**
 * Próximo dia 05 a partir de hoje (hoje inclusive) — padrão de vencimento
 * único definido no modelo comercial (seção 5), pra nunca ter mais de uma
 * data de vencimento circulando entre os clientes.
 */
function proximoDiaVencimento(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const dia = hoje.getDate();
  const data = dia <= 5 ? new Date(ano, mes, 5) : new Date(ano, mes + 1, 5);
  return data.toISOString().slice(0, 10);
}

/**
 * Cadastro de nova empresa cliente + seu primeiro usuário admin. Só pode
 * ser executado por um usuário com papel "super_admin" (dono do MorSafe) —
 * checado aqui no servidor, além de o item de menu só aparecer para esse
 * papel (ver NAV_ITEMS / app-shell.tsx).
 *
 * Usa o cliente com service role (mesmo padrão de usuarios/actions.ts,
 * ver lib/supabase/admin.ts) em vez do supabase.auth.signUp usado antes.
 * Dois motivos, os dois causavam falha real neste fluxo:
 *
 * 1) A tabela `usuarios` hoje só tem política de RLS pra cada usuário ler a
 *    própria linha, sem nenhuma política de inserção — o insert do passo 3
 *    com o client comum (sujeito a RLS) falhava sempre, deixando uma
 *    empresa órfã no banco e um login de autenticação "preso" (e-mail já
 *    registrado, sem conseguir tentar de novo com ele).
 * 2) auth.admin.createUser cria o usuário já com e-mail confirmado e sem
 *    trocar, nos cookies do navegador atual, a sessão de quem está logado
 *    — diferente do auth.signUp comum, que assumia a sessão do usuário
 *    recém-criado e exigia um signOut logo em seguida. O super_admin agora
 *    continua logado depois de cadastrar uma empresa nova.
 *
 * Cada passo que falha desfaz (best-effort) o que os passos anteriores já
 * tinham criado, pra nunca sobrar empresa órfã nem login de auth preso.
 *
 * Mensagens de erro pro usuário são sempre genéricas em português (o
 * detalhe técnico vai só pro log do servidor via console.error) — evita
 * vazar texto cru do Postgres/Supabase Auth pra quem está usando o
 * formulário, mesmo sendo um super_admin.
 */
export async function criarEmpresa(
  _prev: CriarEmpresaState,
