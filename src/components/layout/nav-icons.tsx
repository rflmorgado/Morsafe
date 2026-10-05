import type { ComponentType, ReactNode, SVGProps } from "react";

export type NavIconProps = { className?: string };

// Um único traço (stroke), sem preenchimento, herdando a cor do texto
// (currentColor) — assim o ícone acompanha sozinho o estado ativo/hover do
// item de menu, sem precisar de lógica de cor separada.
function IconBase({
  className,
  children,
  ...rest
}: NavIconProps & { children: ReactNode } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconDashboard({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </IconBase>
  );
}

export function IconColaboradores({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2.5 20.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      <path d="M16 3.7a3.5 3.5 0 0 1 0 6.8" />
      <path d="M21.5 20.5c0-2.9-1.9-5.3-4.5-6.2" />
    </IconBase>
  );
}

export function IconEpis({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <path d="M4 15a8 8 0 0 1 16 0" />
      <path d="M2.5 15h19" />
      <path d="M3.5 15.5v2a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1v-2" />
      <path d="M12 4.5v3" />
    </IconBase>
  );
}

export function IconMovimentacoes({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <path d="M17 3l4 4-4 4" />
      <path d="M3 7h18" />
      <path d="M7 21l-4-4 4-4" />
      <path d="M21 17H3" />
    </IconBase>
  );
}

export function IconEstacoes({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <rect x="4" y="2" width="16" height="20" rx="2.2" />
      <path d="M6.5 15.5c1.1-1.8 2.2-1.8 3.3 0s2.2 1.8 3.3 0 2.2-1.8 3.3 0" />
      <line x1="9" y1="6.3" x2="15" y2="6.3" />
    </IconBase>
  );
}

// Mesmo prédio (sede + anexo) do cabeçalho de "Dados da empresa" (ver
// IconEmpresaHeader em empresa/page.tsx) e do selo de empresa sem logo na
// barra lateral (ver EmpresaBadge em app-shell.tsx) — antes esse ícone do
// menu usava um desenho diferente (prédio com porta/seta), sem bater com o
// resto do app. Unificado, 05/10/2026.
export function IconEmpresa({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <rect x="4" y="3" width="10" height="18" rx="1" />
      <rect x="14" y="9" width="6" height="12" rx="1" />
      <path d="M7.5 7h3M7.5 11h3M7.5 15h3" />
      <path d="M17 13h.01M17 17h.01" />
    </IconBase>
  );
}

// Mesmas duas pessoas do cabeçalho de "Usuários" (ver IconUsuariosHeader em
// usuarios/page.tsx) — antes esse ícone do menu era um cadeado, que não
// combinava com o resto do app (cadeado sugere "segurança/permissão", não
// "pessoas com acesso ao sistema", que é do que a tela trata). Unificado,
// 05/10/2026.
export function IconUsuarios({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6" />
      <path d="M16 9.2a2.8 2.8 0 1 0 0-5.6" />
      <path d="M15 13.3c2.6.4 4.5 2.6 4.5 6.2" />
    </IconBase>
  );
}

export function IconEmpresas({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <rect x="2.5" y="9" width="7" height="12" rx="1" />
      <rect x="10.5" y="3" width="7" height="18" rx="1" />
      <rect x="18.5" y="11" width="3" height="10" rx="0.8" />
      <path d="M5 13h1.5M5 16.5h1.5M13 6.5h3M13 10h3M13 13.5h3M13 17h3" />
    </IconBase>
  );
}

export function IconNovaEmpresa({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M4 21h16" />
    </IconBase>
  );
}

export function IconPagamentos({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <rect x="2.5" y="6" width="19" height="13" rx="2" />
      <path d="M2.5 10h19" />
      <circle cx="12" cy="14.5" r="1.6" />
    </IconBase>
  );
}

export function IconEstoque({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </IconBase>
  );
}

export function IconAuditoria({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 12.5l2 2 4-4" />
    </IconBase>
  );
}

export function IconRelatorios({ className }: NavIconProps) {
  return (
    <IconBase className={className}>
      <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9 17v-3" />
      <path d="M12 17v-6" />
      <path d="M15 17v-2" />
    </IconBase>
  );
}

// Mapeado pelo href do item de menu (ver nav-items.ts) — mantém a lista de
// ícones desacoplada da lista de itens, então adicionar um item novo sem
// ícone correspondente aqui simplesmente não quebra nada (só não mostra
// ícone, ver app-shell.tsx).
export const NAV_ICON_BY_HREF: Record<string, ComponentType<NavIconProps>> = {
  "/dashboard": IconDashboard,
  "/colaboradores": IconColaboradores,
  "/epis": IconEpis,
  "/movimentacoes": IconMovimentacoes,
  "/estacoes": IconEstacoes,
  "/empresa": IconEmpresa,
  "/empresas": IconEmpresas,
  "/pagamentos": IconPagamentos,
  "/usuarios": IconUsuarios,
  "/setup-empresa": IconNovaEmpresa,
  "/estoque": IconEstoque,
  "/auditoria": IconAuditoria,
  "/relatorios": IconRelatorios,
};
