import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { DonutChart } from "@/components/ui/donut-chart";
import { BarTrendChart } from "@/components/ui/bar-trend-chart";
import { getDashboardData } from "@/lib/data/dashboard";
import { getDashboardSuperAdmin } from "@/lib/data/dashboard-super-admin";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { listColaboradoresAtivos, listEpisAtivos } from "@/lib/data/movimentacoes";
import { listEstacoesAtivas } from "@/lib/data/estacoes-assinatura";
import { DashboardSuperAdmin } from "./dashboard-super-admin";
import { RegistrarEntregaButton } from "../movimentacoes/registrar-entrega-button";
import { RegistrarDevolucaoButton } from "../movimentacoes/registrar-devolucao-button";
import { RegistrarEntradaButton } from "../estoque/registrar-entrada-button";

// Ícones dos 4 KPIs — cada um simples o bastante pra ler bem nos 20px do
// "chip" colorido do KpiCard, sem depender de um pacote de ícones externo.
function IconTruck(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M2 7h11v9H2z" />
      <path d="M13 10h4.5l3.5 3.2V16h-8z" />
      <circle cx="6.5" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
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

function IconBox(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M3.5 8 12 4l8.5 4-8.5 4z" />
      <path d="M3.5 8v8l8.5 4 8.5-4V8" />
      <path d="M12 12v8" />
    </svg>
  );
}

function IconCalendarAlert(props: React.SVGProps<SVGSVGElement>) {
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
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4M16 3v4" />
      <path d="M12 13v3" />
      <circle cx="12" cy="18.2" r="0.15" fill="currentColor" />
    </svg>
  );
}

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

// Cores de STATUS (bom/alerta/crítico) dos dois donuts "Situação do NR-06" e
// "Situação do estoque" — hexadecimais próprios, não os mesmos usados nos
// badges de texto do resto do app (--brand-700/--warning-text/--danger-text,
// otimizados pra TEXTO sobre um fundo claro de badge). Como preenchimento
// sólido de uma fatia do donut, contra o fundo do Card (--surface) nos dois
// temas, aqueles ficam baixo demais de contraste no tema escuro (~2.2–2.7:1
// medido). Estes três garantem >= 3:1 nos dois temas (claro/escuro),
// calculado com a mesma fórmula de contraste (WCAG) usada pelo validador da
// skill de dataviz — por isso não precisam de uma variante por tema, ao
// contrário da paleta categórica em globals.css (--chart-cat-*).
const COR_BOM = "#2f9e5b";
const COR_ALERTA = "#c9850e";
const COR_CRITICO = "#d1453d";

// Paleta categórica (identidade, não status) do donut "Gasto por setor" —
// ver os tokens e o comentário completo em globals.css (--chart-cat-1..5).
// Usada via var(), não hex direto, porque essa — ao contrário das 3 cores
// de status acima — tem valores diferentes por tema (claro/escuro).
const CORES_SETOR = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
];
// "Outros" (6º+ setor, quando existe) não é mais uma cor categórica — é
// "o resto", por isso cinza neutro (mesmo tom de --text-muted), nunca uma
// 6ª cor da escala (a skill de dataviz é explícita: identidade categórica
// nunca cresce sem limite, o que sobra dobra em "Outros").
const COR_OUTROS = "var(--text-muted)";

export default async function DashboardPage() {
  // Precisa da empresa do usuário logado ANTES de buscar os números do
  // dashboard (ver getDashboardData) — não dá mais pra buscar os dois em
  // paralelo com Promise.all como antes, já que agora um depende do outro.
  const user = await getCurrentUser();

  // super_admin não pertence a nenhuma empresa — o Dashboard operacional
  // abaixo (entregas, gasto, estoque, CA vencendo) não diz nada sobre o
  // negócio dele, só sobre a operação de uma empresa cliente. Ver
  // dashboard-super-admin.tsx pra visão própria (empresas, usuários na
  // plataforma, pagamentos, atividade administrativa recente).
  if (user?.papel === "super_admin") {
    const dataSuperAdmin = await getDashboardSuperAdmin();
    return <DashboardSuperAdmin data={dataSuperAdmin} nome={user.nome} />;
  }

  const empresaId = user?.empresaId ?? null;
  // Mesmo nível de colaboradores/EPIs/movimentações: "encarregado"+ registra
  // entrega, devolução e entrada de estoque — ver mesma checagem em
  // movimentacoes/page.tsx e estoque/page.tsx. Sem isso, um usuário
  // "leitura" veria botões que a Server Action por trás ia recusar de
  // qualquer forma.
  const podeGerenciar = temPapelMinimo(user?.papel, "encarregado");

  const [data, colaboradoresAtivos, episAtivos, estacoesAtivas] =
    await Promise.all([
      getDashboardData(empresaId),
      listColaboradoresAtivos(empresaId),
      listEpisAtivos(empresaId),
      listEstacoesAtivas(empresaId),
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
        {podeGerenciar && (
          <RegistrarEntregaButton
            colaboradores={colaboradoresAtivos}
            epis={episAtivos}
            estacoes={estacoesAtivas}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Entregas no mês"
          value={data.entregasMes}
          icon={<IconTruck className="h-5 w-5" />}
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
          icon={<IconWallet className="h-5 w-5" />}
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
          icon={<IconBox className="h-5 w-5" />}
          delta={data.estoqueBaixoTotal > 0 ? "Ação recomendada" : "Tudo certo"}
          deltaTone={data.estoqueBaixoTotal > 0 ? "warn" : "up"}
        />
        <KpiCard
          label="CAs vencendo em 30 dias"
          value={data.caVencendoTotal}
          icon={<IconCalendarAlert className="h-5 w-5" />}
          delta={
            data.caVencendoTotal > 0
              ? "Renovar com fornecedor"
              : "Tudo em dia"
          }
          deltaTone={data.caVencendoTotal > 0 ? "warn" : "up"}
        />
      </div>

      {/* Três donuts lado a lado — NR-06 e Estoque reaproveitam dado que já
          existe (status calculado em getEstoqueStatusCounts/
          getNr06StatusCounts); Gasto por setor substitui o que antes só
          aparecia como texto solto no card "Gasto no mês" lá em cima (ver
          `topSetor`, mantido ali pra não tirar aquele resumo rápido). Fica
          numa seção própria, separada dos KPIs e dos Alertas/Ações rápidas
          — pedido do Rafael pra não "amontoar" tudo numa tela só. */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3.5 text-sm font-semibold text-foreground">
            Situação do NR-06
          </h3>
          <DonutChart
            centerLabel={String(data.nr06.emDia + data.nr06.pendente)}
            centerSublabel="colaboradores"
            data={[
              { label: "Em dia", value: data.nr06.emDia, color: COR_BOM },
              { label: "Pendente", value: data.nr06.pendente, color: COR_ALERTA },
            ]}
          />
        </Card>

        <Card>
          <h3 className="mb-3.5 text-sm font-semibold text-foreground">
            Situação do estoque
          </h3>
          <DonutChart
            centerLabel={String(
              data.estoqueStatus.ok +
                data.estoqueStatus.alerta +
                data.estoqueStatus.critico,
            )}
            centerSublabel="EPIs"
            data={[
              { label: "OK", value: data.estoqueStatus.ok, color: COR_BOM },
              {
                label: "No limite",
                value: data.estoqueStatus.alerta,
                color: COR_ALERTA,
              },
              {
                label: "Crítico",
                value: data.estoqueStatus.critico,
                color: COR_CRITICO,
              },
            ]}
          />
        </Card>

        <Card>
          <h3 className="mb-3.5 text-sm font-semibold text-foreground">
            Gasto por setor no mês
          </h3>
          {data.gastoPorSetor.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nenhum gasto registrado neste mês ainda.
            </p>
          ) : (
            <DonutChart
              centerLabel={formatMoney(data.gastoMesTotal)}
              centerLabelClassName="text-[15px]"
              centerSublabel="no mês"
              data={data.gastoPorSetor.map((s, i) => ({
                label: s.nome,
                value: s.valor,
                color: i < CORES_SETOR.length ? CORES_SETOR[i] : COR_OUTROS,
              }))}
            />
          )}
        </Card>
      </div>

      <Card>
        <h3 className="mb-3.5 text-sm font-semibold text-foreground">
          Entregas nos últimos 6 meses
        </h3>
        <BarTrendChart
          data={data.entregasPorMes.map((m) => ({
            label: m.label,
            value: m.total,
          }))}
        />
      </Card>

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
                  className="flex items-center justify-between border-b border-border-subtle py-2.5 text-[13px] transition-colors last:border-b-0 hover:bg-surface-muted/60"
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
                  className="flex items-center justify-between border-b border-border-subtle py-2.5 text-[13px] transition-colors last:border-b-0 hover:bg-surface-muted/60"
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
          {/* "Registrar entrega" já está no botão de destaque lá em cima —
              aqui ficam os outros atalhos, pra não duplicar o mesmo modal
              em dois lugares da mesma tela. Auditoria NR-06 continua "Em
              breve" de verdade (ver nav-items.ts) — as outras três não
              eram: o recurso já existia em Movimentações/Estoque, só não
              estava ligado aqui (ver conversa com Rafael, 01/10/2026). */}
          <div className="flex flex-wrap gap-2">
            {podeGerenciar && (
              <>
                <RegistrarDevolucaoButton
                  colaboradores={colaboradoresAtivos}
                  variant="solid"
                />
                <RegistrarEntradaButton epis={episAtivos} />
              </>
            )}
            <div
              title="Em breve"
              className="flex items-center gap-2 rounded-lg border border-border-strong bg-surface-muted px-3.5 py-2.5 text-[13px] font-medium text-text-muted"
            >
              Rodar auditoria NR-06
              <span className="rounded-full border border-border-strong px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-text-muted">
                Em breve
              </span>
            </div>
          </div>
          {!podeGerenciar && (
            <p className="mt-2.5 text-[12px] text-text-muted">
              Seu perfil de acesso não permite registrar movimentações.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
