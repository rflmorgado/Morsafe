export type NavItem = {
  label: string;
  href: string;
  comingSoon?: boolean;
  // Só aparece para usuários com papel "super_admin" (dono do MorSafe).
  // Usado pelo item de cadastrar novas empresas clientes.
  superAdminOnly?: boolean;
};

// Ordem e nomes espelham o protótipo aprovado (reference/prototipo.html).
// Fase 1 entrega só Dashboard + Colaboradores; o resto fica "em breve"
// até as respectivas fases do roadmap serem implementadas.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Colaboradores", href: "/colaboradores" },
  { label: "EPIs homologados", href: "/epis", comingSoon: true },
  { label: "Movimentações", href: "/movimentacoes", comingSoon: true },
  { label: "Estoque", href: "/estoque", comingSoon: true },
  { label: "Auditoria NR-06", href: "/auditoria", comingSoon: true },
  { label: "Relatórios", href: "/relatorios", comingSoon: true },
  { label: "Nova empresa", href: "/setup-empresa", superAdminOnly: true },
];
