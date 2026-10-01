export type BarPoint = {
  label: string;
  value: number;
};

const ALTURA_MAX_PX = 120;

/**
 * Gráfico de barras simples em HTML/CSS puro (sem SVG nem biblioteca) pra
 * tendência de poucos pontos — pensado pros 6 meses de "Entregas no mês" do
 * Dashboard. Altura de cada barra é proporcional ao MAIOR valor da própria
 * série (nunca a uma escala fixa): um histórico todo baixo (poucas entregas
 * em todos os meses) ainda aparece com barras visíveis, em vez de ficar
 * achatado perto do eixo.
 *
 * O mês mais recente vem em `bg-brand-500` (mesma cor do indicador "▲" do
 * KpiCard) pra marcar "isso é agora" entre os outros 5, em `bg-brand-600` —
 * as duas cores foram escolhidas (não só herdadas da escala de marca) por
 * manterem contraste >= 3:1 contra o Card nos dois temas (claro E escuro),
 * o que a maioria dos tons dessa escala não garante sozinha. O rótulo do
 * mês atual também vem em negrito — a diferença nunca depende só da cor.
 */
export function BarTrendChart({ data }: { data: BarPoint[] }) {
  const maximo = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex h-[160px] items-end gap-3 sm:gap-5">
      {data.map((d, i) => {
        const altura = Math.max(4, Math.round((d.value / maximo) * ALTURA_MAX_PX));
        const atual = i === data.length - 1;
        return (
          <div
            key={`${d.label}-${i}`}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span className="text-[12px] font-bold tabular-nums text-foreground">
              {d.value}
            </span>
            <div
              title={`${d.label}: ${d.value} entrega${d.value === 1 ? "" : "s"}`}
              style={{ height: `${altura}px` }}
              className={`w-full rounded-t-md ${
                atual ? "bg-brand-500" : "bg-brand-600"
              }`}
            />
            <span
              className={`text-[11px] ${
                atual
                  ? "font-bold text-foreground"
                  : "font-semibold text-text-muted"
              }`}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
