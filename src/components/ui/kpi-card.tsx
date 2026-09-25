import { Card } from "./card";

export function KpiCard({
  label,
  value,
  delta,
  deltaTone = "up",
}: {
  label: string;
  value: number | string;
  delta?: string;
  deltaTone?: "up" | "warn";
}) {
  return (
    <Card>
      <p className="text-[11.5px] font-semibold text-text-secondary">
        {label}
      </p>
      <p className="mt-2.5 text-[28px] leading-none font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {delta && (
        <span
          className={`mt-3 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            deltaTone === "warn"
              ? "bg-warning-bg text-warning-text"
              : "bg-brand-100 text-brand-700"
          }`}
        >
          {delta}
        </span>
      )}
    </Card>
  );
}
