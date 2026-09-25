import { Card } from "./card";

const TONE = {
  up: {
    bar: "bg-brand-500",
    chip: "bg-brand-100 text-brand-700",
    pill: "bg-brand-100 text-brand-700",
  },
  warn: {
    bar: "bg-warning-text",
    chip: "bg-warning-bg text-warning-text",
    pill: "bg-warning-bg text-warning-text",
  },
} as const;

export function KpiCard({
  label,
  value,
  delta,
  deltaTone = "up",
  icon,
}: {
  label: string;
  value: number | string;
  delta?: string;
  deltaTone?: "up" | "warn";
  icon?: React.ReactNode;
}) {
  const tone = TONE[deltaTone];

  return (
    <Card className="relative overflow-hidden">
      {/* Faixa de destaque no topo — verde quando a métrica está bem, âmbar
          quando pede atenção. Junto com o ícone, é o que separa um KPI "à
          vontade" (número solto num card branco) de um stat tile de verdade. */}
      <span className={`absolute inset-x-0 top-0 h-[3px] ${tone.bar}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold text-text-secondary">
            {label}
          </p>
          <p className="mt-2 text-[32px] leading-none font-extrabold tracking-tight tabular-nums text-foreground">
            {value}
          </p>
        </div>
        {icon && (
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.chip}`}
          >
            {icon}
          </span>
        )}
      </div>

      {delta && (
        <span
          className={`mt-3 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.pill}`}
        >
          {delta}
        </span>
      )}
    </Card>
  );
}
