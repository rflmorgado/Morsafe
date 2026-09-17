import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { getDashboardData } from "@/lib/data/dashboard";
import { getCurrentUser } from "@/lib/data/current-user";

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

const QUICK_ACTIONS = [
  "Registrar entrega de EPI",
  "Registrar devolução",
  "Dar entrada em estoque",
  "Rodar auditoria NR-06",
];

export default async function DashboardPage() {
  const [data, user] = await Promise.all([
    getDashboardData(),
    getCurrentUser(),
  ]);

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Olá, {user?.nome?.split(" ")[0] ?? "colaborador"}
          </h1>
          <p className="mt-0.5 text-[13px] text-text-secondary">
            {user?.empresaNome ?? "MorSafe"} · {hoje}
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Em breve"
          className="w-full rounded-lg bg-brand-700/40 px-4 py-2.5 text-[13.5px] font-semibold text-white/70 sm:w-auto"
        >
          + Nova entrega
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Entregas no mês"
          value={data.entregasMes}
          delta={
            data.variacaoEntregas === null
              ? undefined
              : `${data.variacaoEntregas >= 0 ? "+" : ""}${data.variacaoEntregas}% vs. mês anterior`
          }
          deltaTone={
            data.variacaoEntregas !== null && data.variacaoEntregas < 0
              ? "warn"
              : "up"
          }
        />
        <KpiCard
          label="Gasto no mês"
          value={formatMoney(data.gastoMesTotal)}
          delta={
            data.topSetor
              ? `Setor ${data.topSetor.nome} concentra ${data.topSetor.pct}%`
              : undefined
          }
          deltaTone="warn"
        />
        <KpiCard
          label="EPIs com estoque baixo"
          value={data.estoqueBaixoTotal}
          delta={data.estoqueBaixoTotal > 0 ? "Ação recomendada" : "Tudo certo"}
          deltaTone={data.estoqueBaixoTotal > 0 ? "warn" : "up"}
        />
        <KpiCard
          label="CAs vencendo em 30 dias"
          value={data.caVencendoTotal}
          delta={
            data.caVencendoTotal > 0
              ? "Renovar com fornecedor"
              : "Tudo em dia"
          }
          deltaTone={data.caVencendoTotal > 0 ? "warn" : "up"}
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h3 className="mb-3.5 text-sm font-semibold text-foreground">
            Alertas
          </h3>

          {data.estoqueBaixo.length === 0 && data.caVencendo.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nenhum alerta no momento.
            </p>
          ) : (
            <div>
              {data.estoqueBaixo.map((item) => (
                <div
                  key={`estoque-${item.epi_id}`}
                  className="flex items-center justify-between border-b border-border-subtle py-2.5 text-[13px] last:border-b-0"
                >
                  <span>
                    {item.nome} —{" "}
                    {item.saldo_atual === 0
                      ? "estoque zerado"
                      : `${item.saldo_atual} unidades restantes`}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      item.saldo_atual === 0
                        ? "bg-danger-bg text-danger-text"
                        : "bg-warning-bg text-warning-text"
                    }`}
                  >
                    {item.saldo_atual === 0 ? "Crítico" : "Baixo"}
                  </span>
                </div>
              ))}
              {data.caVencendo.map((item) => (
                <div
                  key={`ca-${item.epi_id}`}
                  className="flex items-center justify-between border-b border-border-subtle py-2.5 text-[13px] last:border-b-0"
                >
                  <span>
                    CA {item.ca} ({item.nome}) vence em{" "}
                    {item.ca_validade ? formatDate(item.ca_validade) : "—"}
                  </span>
                  <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-[11px] font-semibold text-warning-text">
                    Vencendo
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
            {QUICK_ACTIONS.map((label) => (
              <div
                key={label}
                title="Em breve"
                className="flex items-center justify-between gap-2.5 rounded-lg border border-border-strong bg-surface-muted px-3.5 py-2.5 text-[13px] font-medium text-text-muted"
              >
                {label}
                <span className="rounded-full border border-border-strong px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-text-muted">
                  Em breve
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
