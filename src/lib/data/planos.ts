import type { PlanoAssinatura } from "@/types/database";

/**
 * Tabela de preços do MorSafe — fonte única desses números, usada tanto
 * na implantação de uma empresa nova (setup-empresa/actions.ts) quanto no
 * painel administrativo e na área de assinatura do cliente. Mudar um
 * valor aqui não altera assinaturas já criadas (o valor fica gravado em
 * `assinaturas.valor_mensal` no momento da implantação) — é só o valor
 * padrão sugerido pra implantações novas a partir daqui.
 *
 * "enterprise" não tem valor fixo ("sob consulta", ver modelo comercial)
 * — por isso fica de fora deste mapa; quem cria a assinatura informa o
 * valor negociado manualmente (ver campo valorEnterprise no formulário de
 * nova empresa).
 */
export const PLANO_LABEL: Record<PlanoAssinatura, string> = {
  start: "Start",
  essencial: "Essencial",
  profissional: "Profissional",
  empresa: "Empresa",
  industrial: "Industrial",
  enterprise: "Enterprise",
};

export const PLANO_VALOR_MENSAL: Record<Exclude<PlanoAssinatura, "enterprise">, number> = {
  start: 99,
  essencial: 149,
  profissional: 249,
  empresa: 399,
  industrial: 599,
};

// Limite de colaboradores ativos de cada plano — usado só como sugestão
// inicial ao implantar (grava em empresas.limite_colaboradores); o
// super_admin continua podendo ajustar depois, por empresa, na tela
// /empresas/[id] (ver lib/data/empresas.ts).
export const PLANO_LIMITE_COLABORADORES: Record<Exclude<PlanoAssinatura, "enterprise">, number> = {
  start: 30,
  essencial: 75,
  profissional: 150,
  empresa: 300,
  industrial: 600,
};

export const PLANOS_ORDENADOS: PlanoAssinatura[] = [
  "start",
  "essencial",
  "profissional",
  "empresa",
  "industrial",
  "enterprise",
];

export function formatValorPlano(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
