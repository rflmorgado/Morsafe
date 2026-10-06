import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { IconBadge } from "@/components/ui/icon-badge";
import { DonutChart } from "@/components/ui/donut-chart";
import { BarTrendChart } from "@/components/ui/bar-trend-chart";
import { RankingBars } from "@/components/ui/ranking-bars";
import { apurarRelatorioConsumo } from "@/lib/data/relatorios";
import { getCurrentUser } from "@/lib/data/current-user";

// Mesma paleta categórica (identidade) do Dashboard — ver globals.css
// (--chart-cat-1..5) e o comentário completo em dashboard/page.tsx. Usada
// aqui pros mesmos dois casos: "Por tipo de EPI" (até 5 fatias + Outros) e
// "Por unidade" (normalmente só 2, ViniPlast/Vinitrade, mas a escala
// aguenta até 5 sem repetir cor).
const CORES_CATEGORICAS = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
];
const COR_OUTROS = "var(--text-muted)";
const MAX_FATIAS_DONUT = 5;

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatUnidades(value: number) {
  return `${value.toLocaleString("pt-BR")} un.`;
}

// Agrupa uma lista já ordenada (maior primeiro) em até MAX_FATIAS_DONUT
// fatias nomeadas + uma fatia "Outros" com o resto — mesma regra do
// "Gasto por setor" do Dashboard, repetida aqui porque esta tela usa o
// agrupamento em 3 gráficos diferentes (tipo de EPI nas saídas, tipo nas
// entradas, por unidade).
function agruparComOutros<T extends { valor: number }>(
  itens: T[],
  rotulo: (item: T) => string,
) {
  const principais = itens.slice(0, MAX_FATIAS_DONUT).map((item, i) => ({
    label: rotulo(item),
    value: item.valor,
    color: CORES_CATEGORICAS[i],
  }));
  const resto = itens.slice(MAX_FATIAS_DONUT);
  if (resto.length > 0) {
    principais.push({
      label: "Outros",
      value: resto.reduce((acc, i) => acc + i.valor, 0),
      color: COR_OUTROS,
    });
  }
  return principais;
}

function IconRelatorioHeader(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
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
      <path d="M12 4 2.5 20h19z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.15" fill="currentColor" />
    </svg>
  );
}

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
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
    </svg>
  );
}

function IconDownload(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M12 4v11M8 11l4 4 4-4" />
      <path d="M4 18v1.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V18" />
    </svg>
  );
}

export default async function RelatoriosPage() {
  const user = await getCurrentUser();
  const empresaId = user?.empresaId ?? null;
  const r = await apurarRelatorioConsumo(empresaId);

  const temDados = r.totalQuantidade > 0 || r.porMes.some((m) => m.quantidade > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <PageHeader
          title="Relatórios"
          description={`Consumo de EPI nos últimos ${r.janela.meses} meses (${r.janela.inicioLabel} a ${r.janela.fimLabel}) — quantidade entregue, gasto e de onde ele vem.`}
          icon={<IconRelatorioHeader className="h-5 w-5" />}
        />
        <a
          href="/relatorios/relatorio"
          target="_blank"
          className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
        >
          <IconDownload className="h-4 w-4" />
          Baixar relatório em PDF
        </a>
      </div>

      {!temDados ? (
        <Card>
          <p className="text-sm text-text-secondary">
            Ainda não há entregas registradas nos últimos {r.janela.meses}{" "}
            meses para gerar o relatório. Os números aparecem aqui conforme as
            entregas de EPI forem sendo registradas em Movimentações.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={`Entregas nos últimos ${r.janela.meses} meses`}
              value={r.totalQuantidade}
              icon={<IconBox className="h-5 w-5" />}
              delta={
                r.comparativoAno.variacaoQuantidade === null
                  ? undefined
                  : `${r.comparativoAno.variacaoQuantidade >= 0 ? "+" : ""}${r.comparativoAno.variacaoQuantidade}% vs. 12 meses anteriores`
              }
              deltaTone={
                r.comparativoAno.variacaoQuantidade !== null &&
                r.comparativoAno.variacaoQuantidade > 0
                  ? "warn"
                  : "up"
              }
            />
            <KpiCard
              label="Gasto total no período"
              value={formatMoney(r.totalValor)}
              icon={<IconWallet className="h-5 w-5" />}
              delta={
                r.comparativoAno.variacaoValor === null
                  ? undefined
                  : `${r.comparativoAno.variacaoValor >= 0 ? "+" : ""}${r.comparativoAno.variacaoValor}% vs. 12 meses anteriores`
              }
              deltaTone={
                r.comparativoAno.variacaoValor !== null &&
                r.comparativoAno.variacaoValor > 0
                  ? "warn"
                  : "up"
              }
            />
            <KpiCard
              label="Variação no último mês"
              value={
                r.comparativoMes.variacaoQuantidade === null
                  ? "—"
                  : `${r.comparativoMes.variacaoQuantidade >= 0 ? "+" : ""}${r.comparativoMes.variacaoQuantidade}%`
              }
              icon={<IconRelatorioHeader className="h-5 w-5" />}
              delta="Quantidade entregue vs. mês anterior"
              deltaTone={
                r.comparativoMes.variacaoQuantidade !== null &&
                r.comparativoMes.variacaoQuantidade > 0
                  ? "warn"
                  : "up"
              }
            />
            <KpiCard
              label="Entregas por perda, dano ou roubo"
              value={r.consumoAnomalo.quantidade}
              icon={<IconAlertTriangle className="h-5 w-5" />}
              delta={`${r.consumoAnomalo.pct}% do total · ${formatMoney(r.consumoAnomalo.valor)}`}
              deltaTone={r.consumoAnomalo.quantidade > 0 ? "danger" : "up"}
            />
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3.5 flex items-center gap-2.5 text-sm font-semibold text-foreground">
                <IconBadge
                  icon={<IconRelatorioHeader className="h-3.5 w-3.5" />}
                  size="sm"
                />
                Entregas por mês — quantidade
              </h3>
              <BarTrendChart
                data={r.porMes.map((m) => ({ label: m.label, value: m.quantidade }))}
              />
            </Card>
            <Card>
              <h3 className="mb-3.5 flex items-center gap-2.5 text-sm font-semibold text-foreground">
                <IconBadge icon={<IconWallet className="h-3.5 w-3.5" />} size="sm" />
                Gasto por mês
              </h3>
              <BarTrendChart
                data={r.porMes.map((m) => ({ label: m.label, value: Math.round(m.valor) }))}
              />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.3fr_1fr]">
            <Card>
              <h3 className="mb-1 flex items-center gap-2.5 text-sm font-semibold text-foreground">
                <IconBadge icon={<IconBox className="h-3.5 w-3.5" />} size="sm" />
                Setor com maior consumo
              </h3>
              <p className="mb-3.5 text-[12px] text-text-muted">
                Classificação por gasto no período, maior primeiro.
              </p>
              <RankingBars
                items={r.porSetor.map((s) => ({
                  label: s.setorNome,
                  sublabel: `${s.unidadeNome} · ${s.quantidade} un.`,
                  value: s.valor,
                }))}
                formatValue={formatMoney}
              />
            </Card>

            <Card>
              <h3 className="mb-3.5 flex items-center gap-2.5 text-sm font-semibold text-foreground">
                <IconBadge icon={<IconBuilding className="h-3.5 w-3.5" />} size="sm" />
                Consumo por unidade
              </h3>
              {r.porUnidade.length === 0 ? (
                <p className="text-sm text-text-muted">Nenhum dado no período.</p>
              ) : (
                <DonutChart
                  centerLabel={formatMoney(r.totalValor)}
                  centerLabelClassName="text-[15px]"
                  centerSublabel="no período"
                  data={agruparComOutros(r.porUnidade, (u) => u.unidadeNome)}
                />
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
            <Card>
              <h3 className="mb-3.5 flex items-center gap-2.5 text-sm font-semibold text-foreground">
                <IconBadge icon={<IconBox className="h-3.5 w-3.5" />} size="sm" />
                Saídas por tipo de EPI
              </h3>
              {r.porTipoEpi.length === 0 ? (
                <p className="text-sm text-text-muted">Nenhum dado no período.</p>
              ) : (
                <DonutChart
                  centerLabel={String(r.totalQuantidade)}
                  centerSublabel="unidades"
                  data={agruparComOutros(
                    r.porTipoEpi
                      .map((t) => ({ tipo: t.tipo, valor: t.quantidade }))
                      .sort((a, b) => b.valor - a.valor),
                    (t) => t.tipo,
                  )}
                />
              )}
            </Card>

            <Card>
              <h3 className="mb-1 flex items-center gap-2.5 text-sm font-semibold text-foreground">
                <IconBadge icon={<IconBox className="h-3.5 w-3.5" />} size="sm" />
                Entradas por tipo de EPI
              </h3>
              <p className="mb-3.5 text-[12px] text-text-muted">
                {r.entradasTotal.quantidade} un. compradas ·{" "}
                {formatMoney(r.entradasTotal.valor)} no período.
              </p>
              <RankingBars
                items={r.entradasPorTipo.map((t) => ({
                  label: t.tipo,
                  sublabel: formatUnidades(t.quantidade),
                  value: t.valor,
                }))}
                formatValue={formatMoney}
                maxItems={6}
              />
            </Card>

            <Card>
              <h3 className="mb-1 flex items-center gap-2.5 text-sm font-semibold text-foreground">
                <IconBadge
                  icon={<IconAlertTriangle className="h-3.5 w-3.5" />}
                  tone="warn"
                  size="sm"
                />
                Motivo das entregas
              </h3>
              <p className="mb-3.5 text-[12px] text-text-muted">
                Reposição esperada (desgaste, vencimento) separada do que
                custa evitar (dano, perda, roubo).
              </p>
              <ul className="space-y-2">
                {r.porMotivo.map((m) => (
                  <li
                    key={m.motivo}
                    className="flex items-center justify-between gap-2 border-b border-border-subtle py-1.5 text-[12.5px] last:border-b-0"
                  >
                    <span
                      className={
                        m.motivo === "troca_dano" ||
                        m.motivo === "perda" ||
                        m.motivo === "roubo"
                          ? "font-semibold text-danger-text"
                          : "text-foreground"
                      }
                    >
                      {m.label}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-text-secondary">
                      {m.quantidade} <span className="text-text-muted">({m.pct}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <p className="text-center text-[11.5px] text-text-muted">
            Período fixo de {r.janela.meses} meses, sempre contando a partir
            de hoje. Para o detalhe de cada entrega ou entrada,{" "}
            <Link href="/movimentacoes" className="font-semibold text-brand-700 hover:underline">
              veja Movimentações
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
