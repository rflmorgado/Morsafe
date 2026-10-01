export type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

const SIZE = 120;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RADIUS;

/**
 * Donut chart em SVG puro, sem biblioteca de gráfico — técnica clássica de
 * stroke-dasharray/stroke-dashoffset num <circle>, girado -90° pra começar
 * às 12h em vez de às 3h (padrão do SVG). Decisão deliberada de não instalar
 * uma lib (tipo Recharts): o Rafael só cola arquivo por arquivo no editor
 * web do GitHub, sem rodar `npm install` — uma dependência nova te deixa
 * refém do lockfile instalar certo na Vercel. Pensado pra poucas fatias (2
 * a 6): cada uma sempre junto de uma legenda com o rótulo e o valor, nunca
 * só a cor sozinha (ver skill de dataviz, references/anti-patterns.md).
 *
 * `centerLabel`/`centerSublabel` ficam no meio do anel — normalmente o
 * total (ex.: "125" colaboradores) e uma legenda curta (ex.: "ativos").
 */
export function DonutChart({
  data,
  centerLabel,
  centerSublabel,
  centerLabelClassName = "text-[22px]",
}: {
  data: DonutSlice[];
  centerLabel: string;
  centerSublabel?: string;
  // Rótulo central mais comprido (ex.: um valor em R$) precisa de uma fonte
  // menor pra não estourar o furo de ~80px do donut — ver uso em
  // dashboard/page.tsx (gráfico "Gasto por setor").
  centerLabelClassName?: string;
}) {
  const total = data.reduce((acc, d) => acc + d.value, 0);

  let acumulado = 0;
  const fatias = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const comprimento = total > 0 ? (d.value / total) * CIRCUNFERENCIA : 0;
      const dashoffset = -acumulado;
      acumulado += comprimento;
      return { ...d, comprimento, dashoffset, key: `${d.label}-${i}` };
    });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="shrink-0"
        role="img"
        aria-label={`${centerLabel}${centerSublabel ? ` ${centerSublabel}` : ""}`}
      >
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {total === 0 ? (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth={STROKE}
            />
          ) : (
            fatias.map((f) => (
              <circle
                key={f.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={f.color}
                strokeWidth={STROKE}
                strokeDasharray={`${f.comprimento} ${CIRCUNFERENCIA - f.comprimento}`}
                strokeDashoffset={f.dashoffset}
              >
                <title>{`${f.label}: ${f.value}`}</title>
              </circle>
            ))
          )}
        </g>

        <text
          x={SIZE / 2}
          y={centerSublabel ? SIZE / 2 - 6 : SIZE / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="currentColor"
          className={`text-foreground font-extrabold ${centerLabelClassName}`}
        >
          {centerLabel}
        </text>
        {centerSublabel && (
          <text
            x={SIZE / 2}
            y={SIZE / 2 + 14}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="currentColor"
            className="text-text-muted text-[9px] font-semibold tracking-wide uppercase"
          >
            {centerSublabel}
          </text>
        )}
      </svg>

      <ul className="w-full flex-1 space-y-1.5">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li
              key={d.label}
              className="flex items-center justify-between gap-3 text-[12.5px]"
            >
              <span className="flex min-w-0 items-center gap-2 text-foreground">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                <span className="truncate">{d.label}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-text-secondary">
                {d.value}{" "}
                <span className="text-text-muted">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
