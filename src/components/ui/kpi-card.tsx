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
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {delta && (
        <p
          className={`mt-1.5 text-xs font-medium ${
            deltaTone === "warn" ? "text-warning-text" : "text-brand-600"
          }`}
        >
          {delta}
        </p>
      )}
    </Card>
  );
}
