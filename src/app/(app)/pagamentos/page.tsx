import Link from "next/link";
import { getCurrentUser } from "@/lib/data/current-user";
import { listPagamentosConsolidado, formatStatusPagamento } from "@/lib/data/pagamentos";
import { listEmpresasParaSelect } from "@/lib/data/empresas";
import { PageHeader } from "@/components/ui/page-header";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { NovoPagamentoButton } from "./novo-pagamento-button";
import { MarcarPagoButton } from "./marcar-pago-button";

// `data_vencimento`/`data_pagamento` são `date` puro (sem hora/fuso) — por
// isso o "T00:00:00" aqui, igual ao padrão já usado pra `ca_validade` em
// epis: sem isso, o Date nativo interpreta a string como UTC meia-noite e
// mostra um dia a menos em qualquer fuso atrás de UTC (ex.: Brasil).
function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Painel consolidado de pagamentos do super_admin: todas as empresas
 * clientes, um pagamento por linha, ordenado por urgência (atrasado →
 * a vencer → em dia → pago). Pensado pra acompanhar em atrasos/vencimentos
 * sem precisar entrar empresa por empresa — ver também a seção
 * "Pagamentos" dentro de app/(app)/empresas/[id]/page.tsx, pro histórico
 * de uma empresa só.
 */
export default async function PagamentosPage() {
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

  const [pagamentos, empresas] = await Promise.all([
    listPagamentosConsolidado(),
    listEmpresasParaSelect(),
  ]);

  return (
    <div>
      <PageHeader
        title="Pagamentos"
        description="Mensalidade de cada empresa cliente, com os atrasos e vencimentos próximos primeiro."
      />

      <ListToolbar actions={<NovoPagamentoButton empresas={empresas} />} />

      {pagamentos.length === 0 ? (
        <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
          Nenhum pagamento registrado ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                  Empresa
                </th>
                <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                  Valor
                </th>
                <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                  Vencimento
                </th>
                <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                  Status
                </th>
                <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.map((p) => {
                const status = formatStatusPagamento(p.statusComputado);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border-subtle last:border-b-0 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-3 text-[13.5px] font-medium text-foreground">
                      <Link
                        href={`/empresas/${p.empresaId}`}
                        className="hover:text-brand-700 hover:underline"
                      >
                        {p.empresaNome}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-foreground">
                      {formatMoney(p.valor)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-text-secondary">
                      {formatDate(p.dataVencimento)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${status.classe}`}
                      >
                        {status.texto}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.status === "pendente" ? (
                        <MarcarPagoButton
                          pagamentoId={p.id}
                          empresaNome={p.empresaNome}
                        />
                      ) : (
                        <span className="text-[12.5px] text-text-muted">
                          {p.dataPagamento
                            ? `Pago em ${formatDate(p.dataPagamento)}`
                            : "Pago"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
