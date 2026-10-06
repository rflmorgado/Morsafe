import Link from "next/link";
import { listItensParaReporEstoque } from "@/lib/data/estoque";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { PageHeader } from "@/components/ui/page-header";

// Ícone de carrinho de compras — identidade própria desta tela (pedido de
// compra), diferente da caixa isométrica usada em /estoque.
function IconReposicaoHeader(props: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
      <path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7.5H6" />
    </svg>
  );
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default async function ReposicaoEstoquePage() {
  const user = await getCurrentUser();
  const empresaId = user?.empresaId ?? null;

  const itens = await listItensParaReporEstoque(empresaId);

  // Mesmo nível de /epis/export e /movimentacoes/export — exportar é uma
  // ação de quem vai de fato montar o pedido de compra, não uma simples
  // consulta (que qualquer papel autenticado, inclusive "leitura", pode
  // fazer nesta tela).
  const podeExportar = temPapelMinimo(user?.papel, "encarregado");

  const custoTotalEstimado = itens.reduce((soma, i) => soma + i.custoEstimado, 0);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/estoque"
          className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-text-secondary transition hover:text-brand-700"
        >
          ← Voltar para Estoque
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            title="Itens para repor estoque"
            description="EPIs com saldo abaixo do limite de alerta configurado, e quanto comprar de cada um para voltar ao nível mínimo."
            icon={<IconReposicaoHeader className="h-5 w-5" />}
          />

          {podeExportar && itens.length > 0 && (
            <a
              href="/estoque/reposicao/export"
              title="Exportar esta lista em CSV"
              className="flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-2.5 text-[13px] font-semibold text-foreground transition hover:bg-surface-muted"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M12 3v12" />
                <path d="M7 10l5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Exportar CSV
            </a>
          )}
        </div>
      </div>

      {itens.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface px-6 py-10 text-center shadow-card">
          <p className="text-[14px] font-semibold text-foreground">
            Nenhum item precisa de reposição no momento
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">
            Todo o estoque ativo está dentro (ou acima) do limite de alerta
            configurado em cada EPI.
          </p>
        </div>
      ) : (
        <>
          {/* Tabela — mesmo critério de largura mínima (`xl`) já usado em
              Estoque/EPIs/Movimentações: abaixo disso ela não cabe de forma
              confiável sem rolar de lado. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card xl:block">
            <table className="w-full border-collapse bg-surface text-left">
              <thead>
                <tr>
                  {[
                    "EPI",
                    "Tipo",
                    "C.A.",
                    "Saldo atual",
                    "Limite de alerta",
                    "Comprar",
                    "Custo estimado",
                  ].map((label) => (
                    <th
                      key={label}
                      className="border-b border-border-subtle bg-surface-muted px-3 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-muted/70"
                  >
                    <td className="max-w-[180px] px-3 py-[9px] text-[12.5px] font-medium text-foreground">
                      <span className="block truncate" title={item.nome}>
                        {item.nome}
                      </span>
                    </td>
                    <td className="max-w-[172px] px-3 py-[9px] text-[12.5px] text-foreground">
                      <span className="block truncate" title={item.tipo ?? undefined}>
                        {item.tipo ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-[9px] text-[12.5px] text-foreground">
                      {item.ca ?? "—"}
                    </td>
                    <td className="px-3 py-[9px] text-[12.5px] font-semibold text-danger-text">
                      {item.saldoAtual}
                    </td>
                    <td className="px-3 py-[9px] text-[12.5px] text-foreground">
                      {item.limiteAlerta}
                    </td>
                    <td className="px-3 py-[9px] text-[12.5px] font-bold text-brand-700">
                      {item.quantidadeComprar}
                    </td>
                    <td className="px-3 py-[9px] text-[12.5px] text-foreground">
                      {formatMoney(item.custoEstimado)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-[10px] text-right text-[12.5px] font-semibold text-text-secondary"
                  >
                    Custo estimado total
                  </td>
                  <td className="px-3 py-[10px] text-[13px] font-bold text-foreground">
                    {formatMoney(custoTotalEstimado)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Lista de cartões — telas abaixo de `xl`. */}
          <div className="space-y-2 xl:hidden">
            {itens.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold text-foreground">
                    {item.nome}
                  </span>
                  <span className="shrink-0 text-[13px] font-bold text-brand-700">
                    Comprar: {item.quantidadeComprar}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-secondary">
                  <span>{item.tipo ?? "Sem tipo definido"}</span>
                  <span>C.A. {item.ca ?? "—"}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2.5 text-[12.5px]">
                  <span className="font-semibold text-danger-text">
                    Saldo: {item.saldoAtual}
                    <span className="font-normal text-text-secondary">
                      {" "}
                      / limite {item.limiteAlerta}
                    </span>
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatMoney(item.custoEstimado)}
                  </span>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface-muted px-3.5 py-3">
              <span className="text-[12.5px] font-semibold text-text-secondary">
                Custo estimado total
              </span>
              <span className="text-[13.5px] font-bold text-foreground">
                {formatMoney(custoTotalEstimado)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
