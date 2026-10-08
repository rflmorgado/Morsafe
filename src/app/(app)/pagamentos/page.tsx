import { getCurrentUser } from "@/lib/data/current-user";
import { listPagamentosConsolidado, formatStatusPagamento } from "@/lib/data/pagamentos";
import { listEmpresasParaSelect } from "@/lib/data/empresas";
import { ClickableRow } from "@/components/ui/clickable-row";
import { ClickableCard } from "@/components/ui/clickable-card";
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

// Ícone vibrante do cabeçalho (mesmo tratamento de Dashboard/Colaboradores/
// EPIs/Usuários/Estoque/Empresas) — o mesmo desenho do item de menu
// Pagamentos (ver IconPagamentos em nav-icons.tsx).
function IconPagamentosHeader(props: React.SVGProps<SVGSVGElement>) {
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
      <rect x="2.5" y="6" width="19" height="13" rx="2" />
      <path d="M2.5 10h19" />
      <circle cx="12" cy="14.5" r="1.6" />
    </svg>
  );
}

// Ícones pequenos e neutros (text-text-muted) dentro das células — mesmo
// padrão de colaboradores/page.tsx e empresas/page.tsx: reforço visual
// discreto ao lado do dado, nunca um bloco colorido repetido linha a linha.
// IconEmpresaPequeno é o mesmo prédio de duas torres usado no selo "sem
// logo" de empresas/page.tsx (ver EmpresaLogo), só que sem o bloco colorido
// — aqui é só um marcador de "isso é uma empresa", não a identidade dela.
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

/**
 * Painel consolidado de COBRANÇAS do super_admin (menu renomeado de
 * "Pagamentos" pra "Cobranças" em 08/10/2026 — ver nav-items.ts): todas as
 * empresas clientes, uma cobrança por linha, ordenado por urgência
 * (atrasado → a vencer → em dia → pago). Pensado pra acompanhar atrasos/
 * vencimentos sem precisar entrar empresa por empresa — ver também a seção
 * "Cobranças" dentro de app/(app)/empresas/[id]/page.tsx, pro histórico de
 * uma empresa só.
 *
 * Diferente de /assinaturas (uma linha por EMPRESA, o estado atual do
 * plano — ver comentário lá): aqui cada linha é uma cobrança INDIVIDUAL —
 * tanto a taxa de implantação (lançada manualmente aqui, via "Novo
 * pagamento", já que não é uma cobrança recorrente do Asaas) quanto toda
 * mensalidade que o webhook do Asaas sincroniza automaticamente (ver
 * processarEventoPagamento, api/webhooks/asaas/route.ts) — e qualquer
 * outra cobrança avulsa que não se encaixe numa assinatura.
 *
 * Clicar na linha/cartão leva ao detalhe da empresa daquela cobrança
 * (mesmo destino que o nome da empresa já levava antes, só que agora a
 * linha inteira é clicável — mesmo padrão de empresas/page.tsx); "Marcar
 * como pago" continua um botão à parte, que não navega (ver
 * stopPropagation em marcar-pago-button.tsx).
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
        title="Cobranças"
        description="Taxa de implantação e cada cobrança individual por empresa (inclusive as mensalidades sincronizadas do Asaas) — atrasos e vencimentos próximos primeiro. Visão de plano/MRR por empresa está em Assinaturas."
        icon={<IconPagamentosHeader className="h-5 w-5" />}
      />

      <ListToolbar actions={<NovoPagamentoButton empresas={empresas} />} />

      {pagamentos.length === 0 ? (
        <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
          Nenhum pagamento registrado ainda.
        </p>
      ) : (
        <>
          {/* Tabela — só a partir de `xl` (mesmo limite de
              colaboradores/usuarios/estoque/empresas: menu lateral +
              margens do card deixam pouco mais de 820px líquidos pra
              tabela nesse ponto). Abaixo disso vira a lista de cartões
              logo adiante (bloco `xl:hidden`). Esta tela tem só 5 colunas
              (bem mais leve que Estoque/Empresas, de 7), então o
              orçamento de largura aqui nem chega perto do limite. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card xl:block">
            <table className="w-full border-collapse bg-surface text-left">
              <thead>
                <tr>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Empresa
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Valor
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Vencimento
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
                {pagamentos.map((p) => {
                  const status = formatStatusPagamento(p.statusComputado);
                  return (
                    <ClickableRow
                      key={p.id}
                      href={`/empresas/${p.empresaId}`}
                      label={`Ver detalhes de ${p.empresaNome}`}
                    >
                      <td className="max-w-[260px] px-2.5 py-[9px] text-[12.5px] font-medium text-foreground">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <IconEmpresaPequeno className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                          <span className="min-w-0 truncate" title={p.empresaNome}>
                            {p.empresaNome}
                          </span>
                        </span>
                      </td>
                      <td className="px-2.5 py-[9px] text-[12.5px] text-foreground">
                        {formatMoney(p.valor)}
                      </td>
                      <td className="px-2.5 py-[9px] text-[12.5px] text-text-secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <IconCalendarSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                          {formatDate(p.dataVencimento)}
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
                        {p.status === "pendente" ? (
                          <MarcarPagoButton
                            pagamentoId={p.id}
                            empresaNome={p.empresaNome}
                          />
                        ) : (
                          <span className="text-[12px] text-text-muted">
                            {p.dataPagamento
                              ? `Pago em ${formatDate(p.dataPagamento)}`
                              : "Pago"}
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
              da tabela). Mesmas informações, empilhadas em vez de em
              colunas. */}
          <div className="space-y-2 xl:hidden">
            {pagamentos.map((p) => {
              const status = formatStatusPagamento(p.statusComputado);
              return (
                <ClickableCard
                  key={p.id}
                  href={`/empresas/${p.empresaId}`}
                  label={`Ver detalhes de ${p.empresaNome}`}
                  className="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <IconEmpresaPequeno className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">
                        {p.empresaNome}
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
                      {formatMoney(p.valor)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconCalendarSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      Vence em {formatDate(p.dataVencimento)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
                    {p.status === "pendente" ? (
                      <MarcarPagoButton
                        pagamentoId={p.id}
                        empresaNome={p.empresaNome}
                      />
                    ) : (
                      <span className="text-[12px] text-text-muted">
                        {p.dataPagamento
                          ? `Pago em ${formatDate(p.dataPagamento)}`
                          : "Pago"}
                      </span>
                    )}
                  </div>
                </ClickableCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
