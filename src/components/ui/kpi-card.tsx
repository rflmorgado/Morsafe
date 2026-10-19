import { Card } from "./card";
import { IconBadge } from "./icon-badge";

const TONE = {
  up: {
    bar: "bg-brand-500",
    pill: "bg-brand-100 text-brand-700",
    badgeTone: "brand",
  },
  warn: {
    bar: "bg-warning-text",
    pill: "bg-warning-bg text-warning-text",
    badgeTone: "warn",
  },
  // Terceiro tom, pra KPI que não é "bom" nem "atenção leve" — ex.: um total
  // de registros críticos na Auditoria NR-06 (ver visao-geral-tab.tsx).
  // Primeiro uso: Auditoria, 06/10/2026.
  danger: {
    bar: "bg-danger-text",
    pill: "bg-danger-bg text-danger-text",
    badgeTone: "danger",
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
  deltaTone?: "up" | "warn" | "danger";
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
          {/* xl:text-[20px] — a partir de 4 cards na mesma linha (ver
              grid-cols-4 nas telas que usam este card), o card em si fica
              estreito demais (~100px de texto disponível, já descontado
              ícone+padding) pra um valor de 32px tipo "R$ 308,70" sem
              quebrar feio NO MEIO do número (ex.: "308,7" numa linha e "0"
              sozinho na próxima) — foi exatamente o que o Rafael viu no
              Dashboard, 19/10/2026, print do navegador no PC. Medido com
              Playwright contra o layout real (sidebar 236px + container
              travado em 1180px): 20px é o maior tamanho em que "R$ 308,70"
              cabe numa linha só nessa largura, e valores bem maiores (ex.
              "R$ 12.345,67") no máximo quebram uma vez, sempre no espaço
              depois do "R$" — nunca dentro do número — graças ao
              break-words abaixo. Abaixo de xl (1 ou 2 colunas) o card é
              bem mais largo e o valor continua grande (32px) normalmente. */}
          <p className="mt-2 break-words text-[32px] leading-none font-extrabold tracking-tight tabular-nums text-foreground xl:text-[20px]">
            {value}
          </p>
        </div>
        {icon && <IconBadge icon={icon} tone={tone.badgeTone} />}
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
