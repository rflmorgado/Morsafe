import Link from "next/link";
import { apurarAuditoriaRegistros } from "@/lib/data/auditoria-registros";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card } from "@/components/ui/card";

function IconIndice(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M17 7h4v4" />
    </svg>
  );
}

function IconAlerta(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M12 9v4" />
      <path d="M10.3 3.9 1.9 18a1.8 1.8 0 0 0 1.5 2.7h17.2a1.8 1.8 0 0 0 1.5-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
      <path d="M12 16.2h.01" />
    </svg>
  );
}

const STATUS_DOT = {
  ok: "bg-brand-500",
  atencao: "bg-warning-text",
  critico: "bg-danger-text",
} as const;

const STATUS_LABEL = {
  ok: "Controlado",
  atencao: "Atenção",
  critico: "Crítico",
} as const;

/**
 * "Visão geral" — diagnóstico automático dos REGISTROS já existentes no
 * banco (entregas, devoluções, EPIs, colaboradores), não uma observação
 * humana (isso é o checklist de campo, aba separada). Pedido do Rafael,
 * 06/10/2026, com um cuidado deliberado de vocabulário: nunca "índice de
 * conformidade com a NR-06" — isso seria o MorSafe assumindo uma
 * responsabilidade jurídica que não é dele. Sempre "índice de controle dos
 * registros" (ver apurarAuditoriaRegistros, em lib/data/auditoria-
 * registros.ts, pra como esse número é calculado — a fórmula está comentada
 * lá, de propósito, pra ficar auditável).
 */
export async function VisaoGeralTab({
  empresaId,
}: {
  empresaId: string | null;
}) {
  const apuracao = await apurarAuditoriaRegistros(empresaId);

  if (apuracao.registrosAnalisados === 0) {
    return (
      <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
        Ainda não há entregas, devoluções, EPIs ou colaboradores cadastrados
        suficientes para calcular um diagnóstico.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Índice de controle dos registros"
          value={`${apuracao.indiceControle}%`}
          icon={<IconIndice className="h-5 w-5" />}
          delta={`${apuracao.registrosAnalisados} registros analisados`}
          deltaTone={
            apuracao.criticoTotal > 0
              ? "danger"
              : apuracao.atencaoTotal > 0
                ? "warn"
                : "up"
          }
        />
        <KpiCard
          label="Sem pendência"
          value={apuracao.semPendencia}
          deltaTone="up"
        />
        <KpiCard
          label="Atenção"
          value={apuracao.atencaoTotal}
          icon={<IconAlerta className="h-5 w-5" />}
          deltaTone="warn"
        />
        <KpiCard
          label="Críticos"
          value={apuracao.criticoTotal}
          icon={<IconAlerta className="h-5 w-5" />}
          deltaTone="danger"
        />
      </div>

      {apuracao.criticoTotal + apuracao.atencaoTotal > 0 && (
        <Link
          href="/auditoria?aba=pendencias"
          className="block rounded-2xl border border-border-subtle bg-surface p-4 text-[12.5px] font-semibold text-brand-700 shadow-card hover:bg-brand-50"
        >
          Ver detalhe das pendências →
        </Link>
      )}

      <Card>
        <p className="mb-3.5 text-[13.5px] font-bold text-foreground">
          Raio-X dos controles relacionados à NR-06
        </p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {apuracao.raioX.map((item) => (
            <div key={item.label} className="flex items-start gap-2.5">
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[item.status]}`}
              />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground">
                  {item.label}{" "}
                  <span className="font-normal text-text-muted">
                    — {STATUS_LABEL[item.status]}
                  </span>
                </p>
                <p className="text-[12px] text-text-secondary">
                  {item.detalhe}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p className="rounded-2xl border border-border-subtle bg-surface-muted p-4 text-[12px] text-text-secondary">
        Este diagnóstico analisa o que já está registrado no sistema — não
        substitui a observação em campo (ver aba{" "}
        <Link
          href="/auditoria?aba=checklist"
          className="font-semibold text-brand-700 hover:underline"
        >
          Checklist de campo
        </Link>
        ) nem representa uma declaração de conformidade com a NR-06. As
        pendências identificadas devem ser avaliadas e tratadas pela
        organização.
      </p>
    </div>
  );
}
