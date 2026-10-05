import Link from "next/link";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { IconBadge } from "@/components/ui/icon-badge";
import { DonutChart } from "@/components/ui/donut-chart";
import { BarTrendChart } from "@/components/ui/bar-trend-chart";
import type { DashboardSuperAdminData } from "@/lib/data/dashboard-super-admin";

// Ícones locais, mesmo padrão de dashboard/page.tsx (um arquivo, seus
// próprios ícones — sem depender de pacote externo).
function IconBuilding(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="4" y="3" width="12" height="18" rx="1" />
      <path d="M16 8h4v13" />
      <path d="M4 21h16" />
    </svg>
  );
}

function IconUsers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2.5 20.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      <path d="M16 3.7a3.5 3.5 0 0 1 0 6.8" />
      <path d="M21.5 20.5c0-2.9-1.9-5.3-4.5-6.2" />
    </svg>
  );
}

function IconTrendUp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

function IconWallet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h12A2.5 2.5 0 0 1 20 7.5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M16 12.5h3v3h-3a1.5 1.5 0 0 1 0-3z" />
    </svg>
  );
}

function IconAlertTriangle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="0.15" fill="currentColor" />
    </svg>
  );
}

// Cores de STATUS dos dois donuts abaixo ("Situação dos pagamentos" e
// "Empresas por status") — mesmos hexadecimais já validados (contraste
// >= 3:1 nos dois temas, claro e escuro) em dashboard/page.tsx, pra ficar
// idêntico entre as duas telas de Dashboard. Não são os tokens de badge
// de texto (--brand-700/--warning-text/--danger-text): aqueles ficam baixo
// demais de contraste como preenchimento sólido de fatia no tema escuro
// (ver comentário completo na outra tela). COR_OUTROS é o mesmo cinza
// neutro usado ali pra "o resto" — aqui, pra "inativa", que é um estado
// neutro (empresa desativada), não um alerta.
const COR_BOM = "#2f9e5b";
const COR_ALERTA = "#c9850e";
const COR_CRITICO = "#d1453d";
const COR_OUTROS = "var(--text-muted)";

function formatDateHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Dashboard visto pelo super_admin: visão de negócio (quantas empresas,
 * quantos usuários, quem está devendo), não a operação do dia a dia de uma
 * empresa cliente — ver DashboardPage em page.tsx, que decide qual dos dois
 * renderizar a partir do papel de quem está logado.
 */
export function DashboardSuperAdmin({
  data,
  nome,
}: {
  data: DashboardSuperAdminData;
  nome: string;
}) {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const totalPendencias = data.pagamentosAtrasados + data.pagamentosAVencer;

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Olá, {nome.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-[13px] text-text-secondary">
            Painel do MorSafe · {hoje}
          </p>
        </div>
        <Link
          href="/setup-empresa"
          className="w-full rounded-lg bg-brand-700 px-4 py-2.5 text-center text-[13.5px] font-semibold text-white transition hover:bg-brand-800 sm:w-auto"
        >
          + Nova empresa
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Empresas ativas"
          value={data.totalEmpresasAtivas}
          icon={<IconBuilding className="h-5 w-5" />}
          delta={
            data.totalEmpresasInativas > 0
              ? `${data.totalEmpresasInativas} inativa${data.totalEmpresasInativas === 1 ? "" : "s"}`
              : undefined
          }
          deltaTone={data.totalEmpresasInativas > 0 ? "warn" : "up"}
        />
        <KpiCard
          label="Usuários na plataforma"
          value={data.totalUsuarios}
          icon={<IconUsers className="h-5 w-5" />}
        />
        <KpiCard
          label="Empresas novas no mês"
          value={data.empresasNovasNoMes}
          icon={<IconTrendUp className="h-5 w-5" />}
        />
        <KpiCard
          label="Pagamentos pendentes"
          value={totalPendencias}
          icon={<IconWallet className="h-5 w-5" />}
          delta={
            totalPendencias > 0
              ? `${data.pagamentosAtrasados} atrasado${data.pagamentosAtrasados === 1 ? "" : "s"}`
              : "Tudo em dia"
          }
          deltaTone={data.pagamentosAtrasados > 0 ? "warn" : "up"}
        />
        <KpiCard
          label="Empresas no limite"
          value={data.empresasNoLimiteColaboradores}
          icon={<IconAlertTriangle className="h-5 w-5" />}
          delta={
            data.empresasNoLimiteColaboradores > 0
              ? "Colaboradores no limite do plano"
              : "Nenhuma no limite"
          }
          deltaTone={data.empresasNoLimiteColaboradores > 0 ? "warn" : "up"}
        />
      </div>

      {/* Dois donuts lado a lado — mesmo padrão dos 3 de dashboard/page.tsx
          (donut sempre com legenda, nunca só cor sozinha), só que aqui são 2
          em vez de 3, por isso sm:grid-cols-2 sem o lg:grid-cols-3 daquela
          tela. "Situação dos pagamentos" reaproveita o mesmo dado que já
          existe (pagamentosAtrasados/pagamentosAVencer), hoje só resumido no
          card "Pagamentos pendentes" acima — aqui fica visível a proporção
          entre os dois. Pedido do Rafael, 05/10/2026: "gráficos, mais
          organizado". */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Card>
          <h3 className="mb-3.5 flex items-center gap-2.5 text-sm font-semibold text-foreground">
            <IconBadge icon={<IconWallet className="h-3.5 w-3.5" />} size="sm" />
            Situação dos pagamentos
          </h3>
          <DonutChart
            centerLabel={String(totalPendencias)}
            centerSublabel="pendentes"
            data={[
              {
                label: "Atrasado",
                value: data.pagamentosAtrasados,
                color: COR_CRITICO,
              },
              {
                label: "A vencer",
                value: data.pagamentosAVencer,
                color: COR_ALERTA,
              },
            ]}
          />
        </Card>

        <Card>
          <h3 className="mb-3.5 flex items-center gap-2.5 text-sm font-semibold text-foreground">
            <IconBadge icon={<IconBuilding className="h-3.5 w-3.5" />} size="sm" />
            Empresas por status
          </h3>
          <DonutChart
            centerLabel={String(
              data.totalEmpresasAtivas + data.totalEmpresasInativas,
            )}
            centerSublabel="empresas"
            data={[
              {
                label: "Ativas",
                value: data.totalEmpresasAtivas,
                color: COR_BOM,
              },
              {
                label: "Inativas",
                value: data.totalEmpresasInativas,
                color: COR_OUTROS,
              },
            ]}
          />
        </Card>
      </div>

      <Card>
        <h3 className="mb-3.5 flex items-center gap-2.5 text-sm font-semibold text-foreground">
          <IconBadge icon={<IconTrendUp className="h-3.5 w-3.5" />} size="sm" />
          Novas empresas nos últimos 6 meses
        </h3>
        <BarTrendChart
          data={data.empresasNovasPorMes.map((m) => ({
            label: m.label,
            value: m.total,
          }))}
        />
      </Card>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h3 className="mb-3.5 text-sm font-semibold text-foreground">
            Atividade recente
          </h3>
          {data.atividadeRecente.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nenhuma atividade administrativa recente.
            </p>
          ) : (
            <div>
              {data.atividadeRecente.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 border-b border-border-subtle py-2.5 text-[13px] last:border-b-0"
                >
                  <span className="text-foreground">{item.descricao}</span>
                  <span className="shrink-0 text-[11.5px] text-text-muted">
                    {formatDateHora(item.criadoEm)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-3.5 text-sm font-semibold text-foreground">
            Ações rápidas
          </h3>
          <div className="flex flex-col gap-2">
            <Link
              href="/empresas"
              className="rounded-lg border border-border-strong px-3.5 py-2.5 text-[13px] font-medium text-foreground transition hover:bg-surface-muted"
            >
              Ver todas as empresas
            </Link>
            <Link
              href="/pagamentos"
              className="rounded-lg border border-border-strong px-3.5 py-2.5 text-[13px] font-medium text-foreground transition hover:bg-surface-muted"
            >
              Ver pagamentos
            </Link>
            <Link
              href="/setup-empresa"
              className="rounded-lg border border-border-strong px-3.5 py-2.5 text-[13px] font-medium text-foreground transition hover:bg-surface-muted"
            >
              + Nova empresa
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
