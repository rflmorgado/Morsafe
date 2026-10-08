import { getCurrentUser } from "@/lib/data/current-user";
import {
  listAssinaturasConsolidado,
  getResumoAssinaturas,
  formatStatusAssinatura,
} from "@/lib/data/assinaturas";
import { PLANO_LABEL } from "@/lib/data/planos";
import { ClickableRow } from "@/components/ui/clickable-row";
import { ClickableCard } from "@/components/ui/clickable-card";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { CancelarAssinaturaButton } from "./cancelar-assinatura-button";
import { AlterarPlanoButton } from "./alterar-plano-button";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// `proximo_vencimento` é `date` puro (sem hora/fuso) — mesmo tratamento
// de formatDate em pagamentos/page.tsx: sem o "T00:00:00", o Date nativo
// interpretaria a string como UTC meia-noite e mostraria um dia a menos
// em qualquer fuso atrás de UTC (ex.: Brasil).
function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

// Ícone vibrante do cabeçalho (mesmo tratamento de Dashboard/Pagamentos/
// Empresas) — duas flechas em ciclo, pra reforçar "recorrente" (diferente
// do ícone de Pagamentos, uma única fatura).
function IconAssinaturasHeader(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 4v4h-4" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 20v-4h4" />
    </svg>
  );
}

function IconEmpresaPequeno(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="4" y="3" width="10" height="18" rx="1" />
      <rect x="14" y="9" width="6" height="12" rx="1" />
      <path d="M7.5 7h3M7.5 11h3M7.5 15h3" />
    </svg>
  );
}

function IconCalendarSmall(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4M16 3v4" />
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
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="0.15" fill="currentColor" />
    </svg>
  );
}

function IconLock(props: React.SVGProps<SVGSVGElement>) {
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
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </svg>
  );
}

function IconTrendUp(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M15 7h6v6" />
    </svg>
  );
}

/**
 * Painel administrativo de assinaturas (super_admin) — a visão de negócio
 * sobre a cobrança recorrente via Asaas: quanto está entrando (MRR),
 * quantas empresas estão em cada estado, e a lista completa pra agir
 * (cancelar) quando precisar. Ver modelo comercial, seção do painel
 * administrativo.
 *
 * Diferente de /pagamentos (ledger de cobranças INDIVIDUAIS, uma linha
 * por fatura — inclusive as lançadas manualmente antes do Asaas existir):
 * aqui cada linha é uma EMPRESA, representando o estado atual da
 * assinatura dela.
 */
export default async function AssinaturasPage() {
  const user = await getCurrentUser();

  if (!user || user.papel !== "super_admin") {
    return (
      <div className="space-y-1">
        <PageHeader
          title="Acesso restrito"
          description="Esta página é exclusiva do super_admin."
        />
      </div>
    );
  }

  const [assinaturas, resumo] = await Promise.all([
    listAssinaturasConsolidado(),
    getResumoAssinaturas(),
  ]);

  const emRisco = resumo.inadimplentes + resumo.suspensas;

  return (
    <div>
      <PageHeader
        title="Assinaturas"
        description="Cobrança recorrente via Asaas de cada empresa cliente — MRR, status e implantações."
        icon={<IconAssinaturasHeader className="h-5 w-5" />}
      />

      <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="MRR"
          value={formatMoney(resumo.mrr)}
          icon={<IconWallet className="h-5 w-5" />}
          delta="Ativa + pendente + inadimplente"
        />
        <KpiCard
          label="Assinaturas ativas"
          value={resumo.ativas}
          icon={<IconTrendUp className="h-5 w-5" />}
        />
        <KpiCard
          label="Em risco"
          value={emRisco}
          icon={<IconAlertTriangle className="h-5 w-5" />}
          delta={
            emRisco > 0
              ? `${resumo.inadimplentes} inadimplente${resumo.inadimplentes === 1 ? "" : "s"}, ${resumo.suspensas} suspensa${resumo.suspensas === 1 ? "" : "s"}`
              : "Nenhuma"
          }
          deltaTone={emRisco > 0 ? "danger" : "up"}
        />
        <KpiCard
          label="Implantações realizadas"
          value={resumo.implantacoesRealizadas}
          icon={<IconLock className="h-5 w-5" />}
          delta={`${resumo.canceladas} cancelada${resumo.canceladas === 1 ? "" : "s"}`}
          deltaTone={resumo.canceladas > 0 ? "warn" : "up"}
        />
      </div>

      {assinaturas.length === 0 ? (
        <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
          Nenhuma assinatura criada ainda — toda empresa cadastrada com um
          plano pago (ver /setup-empresa) aparece aqui.
        </p>
      ) : (
        <>
          {/* Tabela a partir de `xl`, mesmo limite das outras telas
              consolidadas (pagamentos/empresas/estoque) — abaixo disso,
              cartões empilhados. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card xl:block">
            <table className="w-full border-collapse bg-surface text-left">
              <thead>
                <tr>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Empresa
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Plano
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Valor/mês
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Próximo vencimento
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Status
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {assinaturas.map((a) => {
                  const status = formatStatusAssinatura(a.status);
                  return (
                    <ClickableRow
                      key={a.id}
                      href={`/empresas/${a.empresaId}`}
                      label={`Ver detalhes de ${a.empresaNome}`}
                    >
                      <td className="max-w-[240px] px-2.5 py-[9px] text-[12.5px] font-medium text-foreground">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <IconEmpresaPequeno className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                          <span className="min-w-0 truncate" title={a.empresaNome}>
                            {a.empresaNome}
                          </span>
                        </span>
                      </td>
                      <td className="px-2.5 py-[9px] text-[12.5px] text-text-secondary">
                        {PLANO_LABEL[a.plano]}
                      </td>
                      <td className="px-2.5 py-[9px] text-[12.5px] text-foreground">
                        {formatMoney(a.valorMensal)}
                      </td>
                      <td className="px-2.5 py-[9px] text-[12.5px] text-text-secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <IconCalendarSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                          {formatDate(a.proximoVencimento)}
                        </span>
                      </td>
                      <td className="px-2.5 py-[9px]">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${status.classe}`}
                        >
                          {status.texto}
                        </span>
                      </td>
                      <td className="px-2.5 py-[9px]">
                        {a.status === "cancelada" ? (
                          <span className="text-[12px] text-text-muted">
                            —
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <AlterarPlanoButton
                              assinaturaId={a.id}
                              empresaNome={a.empresaNome}
                              planoAtual={a.plano}
                            />
                            <CancelarAssinaturaButton
                              assinaturaId={a.id}
                              empresaNome={a.empresaNome}
                            />
                          </span>
                        )}
                      </td>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Lista de cartões — telas abaixo de `xl` (ver comentário acima
              da tabela). */}
          <div className="space-y-2 xl:hidden">
            {assinaturas.map((a) => {
              const status = formatStatusAssinatura(a.status);
              return (
                <ClickableCard
                  key={a.id}
                  href={`/empresas/${a.empresaId}`}
                  label={`Ver detalhes de ${a.empresaNome}`}
                  className="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <IconEmpresaPequeno className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">
                        {a.empresaNome}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${status.classe}`}
                    >
                      {status.texto}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-secondary">
                    <span className="font-semibold text-foreground">
                      {PLANO_LABEL[a.plano]} · {formatMoney(a.valorMensal)}/mês
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconCalendarSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      Vence em {formatDate(a.proximoVencimento)}
                    </span>
                  </div>

                  {a.status !== "cancelada" && (
                    <div className="mt-2.5 flex items-center gap-2 border-t border-border-subtle pt-2.5">
                      <AlterarPlanoButton
                        assinaturaId={a.id}
                        empresaNome={a.empresaNome}
                        planoAtual={a.plano}
                      />
                      <CancelarAssinaturaButton
                        assinaturaId={a.id}
                        empresaNome={a.empresaNome}
                      />
                    </div>
                  )}
                </ClickableCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
