export type NavSection = "operacao" | "sistema" | "em_breve";

export type NavItem = {
  label: string;
  href: string;
  comingSoon?: boolean;
  // Só aparece para usuários com papel "super_admin" (dono do MorSafe).
  // Usado pelo item "Empresas" — a visão de administração do sistema,
  // separada da operação do dia a dia de uma empresa cliente (ver
  // app-shell.tsx: super_admin nunca vê os itens "operacao", só os
  // marcados aqui).
  superAdminOnly?: boolean;
  // Só aparece para o admin de uma empresa cliente (papel exatamente
  // "admin" — não super_admin, que não pertence a nenhuma empresa, nem
  // encarregado/leitura). Usado pela gestão de usuários da própria empresa
  // e pela administração das estações de assinatura.
  adminOnly?: boolean;
  // Agrupamento visual na barra lateral (ver app-shell.tsx) — junta o que é
  // rotina operacional (usado todo dia), separa do que é administração do
  // sistema (usado com bem menos frequência) e do que ainda nem existe.
  section: NavSection;
};

// Ordem pensada como fluxo de uso: primeiro tudo que é operação do dia a
// dia (visão geral → quem → o quê → o registro em si → o apoio a esse
// registro), depois o que é administração do sistema, por último o que
// ainda está no roadmap.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", section: "operacao" },
  { label: "Colaboradores", href: "/colaboradores", section: "operacao" },
  { label: "EPIs homologados", href: "/epis", section: "operacao" },
  { label: "Movimentações", href: "/movimentacoes", section: "operacao" },
  {
    label: "Estações de assinatura",
    href: "/estacoes",
    adminOnly: true,
    section: "operacao",
  },
  {
    label: "Dados da empresa",
    href: "/empresa",
    adminOnly: true,
    section: "sistema",
  },
  { label: "Usuários", href: "/usuarios", adminOnly: true, section: "sistema" },
  {
    label: "Empresas",
    href: "/empresas",
    superAdminOnly: true,
    section: "sistema",
  },
  {
    label: "Pagamentos",
    href: "/pagamentos",
    superAdminOnly: true,
    section: "sistema",
  },
  { label: "Estoque", href: "/estoque", section: "operacao" },
  {
    label: "Auditoria NR-06",
    href: "/auditoria",
    comingSoon: true,
    section: "em_breve",
  },
  {
    label: "Relatórios",
    href: "/relatorios",
    comingSoon: true,
    section: "em_breve",
  },
];

export const NAV_SECTION_LABEL: Record<NavSection, string> = {
  operacao: "Operação",
  sistema: "Sistema",
  em_breve: "Em breve",
};
