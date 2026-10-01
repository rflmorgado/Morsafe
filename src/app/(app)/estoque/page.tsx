import Link from "next/link";
import {
  listEstoquePorEpi,
  listEntradasEstoque,
  ESTOQUE_PAGE_SIZE,
  ENTRADAS_ESTOQUE_PAGE_SIZE,
} from "@/lib/data/estoque";
import { listEpisAtivos } from "@/lib/data/movimentacoes";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { PageHeader } from "@/components/ui/page-header";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { EstoqueFilters } from "./estoque-filters";
import { RegistrarEntradaButton } from "./registrar-entrada-button";
import { ImportarEstoqueButton } from "./importar-estoque-button";
import { ImportarCatalogoEstoqueButton } from "./importar-catalogo-estoque-button";
import { EditarLimiteButton } from "./editar-limite-button";

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

// `criado_em` é gravado em UTC (timestamptz) — sem o `timeZone` abaixo, a
// formatação usaria o fuso do processo Node (UTC na Vercel), mostrando um
// horário 3h à frente do horário real de Brasília. Mesmo bug já corrigido
// em usuarios/[id]/historico/page.tsx e em colaboradores/[id]/ficha/route.ts.
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

type SortKey = "nome" | "tipo" | "custo_medio";

const COLUNAS: { label: string; sortKey: SortKey | null }[] = [
  { label: "EPI", sortKey: "nome" },
  { label: "Tipo", sortKey: "tipo" },
  { label: "C.A.", sortKey: null },
  { label: "Saldo atual", sortKey: null },
  { label: "Limite de alerta", sortKey: null },
  { label: "Custo médio", sortKey: "custo_medio" },
  { label: "", sortKey: null },
];

type Filtros = {
  q?: string;
  tipo?: string;
  sort?: string;
  dir?: string;
  page?: number;
  entradasPage?: number;
};

function buildHref(atual: Filtros, overrides: Partial<Filtros>) {
  const m = { ...atual, ...overrides };
  const params = new URLSearchParams();
  if (m.q) params.set("q", m.q);
  if (m.tipo) params.set("tipo", m.tipo);
  if (m.sort) params.set("sort", m.sort);
  if (m.dir) params.set("dir", m.dir);
  if (m.page && m.page > 1) params.set("page", String(m.page));
  if (m.entradasPage && m.entradasPage > 1)
    params.set("entradasPage", String(m.entradasPage));
  const qs = params.toString();
  return `/estoque${qs ? `?${qs}` : ""}`;
}

/**
 * Clicar num cabeçalho de coluna ordena por ela; clicar de novo inverte a
 * direção. Trocar a ordenação sempre volta a lista de EPIs pra página 1
 * (mas preserva a página do histórico de entradas, que é independente).
 */
function buildSortHref(atual: Filtros, coluna: SortKey) {
  const sortAtual = atual.sort ?? "nome";
  const dirAtual = atual.dir ?? "asc";
  const proximaDir = sortAtual === coluna && dirAtual !== "desc" ? "desc" : "asc";
  return buildHref(atual, { sort: coluna, dir: proximaDir, page: 1 });
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    tipo?: string;
    sort?: string;
    dir?: string;
    page?: string;
    entradasPage?: string;
  }>;
}) {
  const {
    q,
    tipo,
    sort,
    dir,
    page: pageParam,
    entradasPage: entradasPageParam,
  } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const entradasPage = Math.max(1, Number(entradasPageParam) || 1);
  const sortAtual = sort ?? "nome";
  const dirAtual = dir ?? "asc";

  const filtros: Filtros = { q, tipo, sort, dir, page, entradasPage };

  // Precisa da empresa do usuário logado antes de disparar o resto (mesmo
  // raciocínio de epis/page.tsx e movimentacoes/page.tsx).
  const user = await getCurrentUser();
  const empresaId = user?.empresaId ?? null;

  const [{ itens, total }, { entradas, total: totalEntradas }, episAtivos] =
    await Promise.all([
      listEstoquePorEpi({ empresaId, query: q, tipo, sort, dir, page }),
      listEntradasEstoque({ empresaId, page: entradasPage }),
      listEpisAtivos(empresaId),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / ESTOQUE_PAGE_SIZE));
  const totalPaginasEntradas = Math.max(
    1,
    Math.ceil(totalEntradas / ENTRADAS_ESTOQUE_PAGE_SIZE),
  );

  // Mesma regra de EPIs/Movimentações: "encarregado"+ registra entrada e
  // ajusta limite de alerta — não é uma ação mais sensível que cadastrar um
  // EPI ou registrar uma entrega.
  const podeGerenciar = temPapelMinimo(user?.papel, "encarregado");
  // Importação em massa exige "admin", mesmo nível de Importar EPIs/
  // Importar colaboradores — um mapeamento de coluna errado bagunça o
  // estoque inteiro de uma vez (ver comentário em actions.ts).
  const podeImportar = temPapelMinimo(user?.papel, "admin");

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title="Estoque"
          description="Saldo atual por EPI e histórico de compras registradas."
        />

        <ListToolbar
          filters={<EstoqueFilters />}
          actions={
            podeGerenciar && (
              <>
                {podeImportar && (
                  <>
                    <ImportarCatalogoEstoqueButton epis={episAtivos} />
                    <ImportarEstoqueButton epis={episAtivos} />
                  </>
                )}
                <RegistrarEntradaButton epis={episAtivos} />
              </>
            )
          }
        />

        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
          <table className="w-full min-w-[760px] border-collapse bg-surface text-left">
            <thead>
              <tr>
                {COLUNAS.map((coluna) => (
                  <th
                    key={coluna.label || "acoes"}
                    className="border-b border-border-subtle bg-surface-muted px-4 py-3.5 text-[11px] font-semibold tracking-[0.04em] text-text-secondary uppercase"
                  >
                    {coluna.sortKey ? (
                      <Link
                        href={buildSortHref(filtros, coluna.sortKey)}
                        className="inline-flex items-center gap-1 transition hover:text-brand-700"
                      >
                        {coluna.label}
                        <span className="text-[9px]">
                          {sortAtual === coluna.sortKey
                            ? dirAtual === "desc"
                              ? "▼"
                              : "▲"
                            : ""}
                        </span>
                      </Link>
                    ) : (
                      coluna.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm text-text-muted">
                    Nenhum EPI ativo encontrado.
                  </td>
                </tr>
              ) : (
                itens.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-muted/70 ${
                      item.baixoEstoque ? "bg-danger-bg/30" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5 text-[13.5px] font-medium text-foreground">
                      {item.nome}
                    </td>
                    <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                      {item.tipo ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                      {item.ca ?? "—"}
                    </td>
                    <td
                      className={`px-4 py-3.5 text-[13.5px] ${
                        item.baixoEstoque
                          ? "font-semibold text-danger-text"
                          : "text-foreground"
                      }`}
                    >
                      {item.saldoAtual}
                      {item.baixoEstoque && (
                        <span className="ml-1.5 rounded-full bg-danger-bg px-2 py-0.5 text-[10.5px] font-semibold text-danger-text">
                          Estoque baixo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                      {item.limiteAlerta}
                    </td>
                    <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                      {formatMoney(item.custoMedioAtual)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {podeGerenciar && (
                        <EditarLimiteButton
                          epiId={item.id}
                          epiNome={item.nome}
                          limiteAtual={item.limiteAlerta}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <span className="text-[12.5px] text-text-secondary">
              Página {page} de {totalPages} · {total} EPI
              {total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Link
                href={buildHref(filtros, { page: page - 1 })}
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
                className={`rounded-lg border border-border-strong px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition ${
                  page <= 1
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-surface-muted"
                }`}
              >
                ← Anterior
              </Link>
              <Link
                href={buildHref(filtros, { page: page + 1 })}
                aria-disabled={page >= totalPages}
                tabIndex={page >= totalPages ? -1 : undefined}
                className={`rounded-lg border border-border-strong px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition ${
                  page >= totalPages
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-surface-muted"
                }`}
              >
                Próxima →
              </Link>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-[15px] font-bold text-foreground">
          Últimas entradas
        </h3>

        <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-card">
          {entradas.length === 0 ? (
            <p className="px-6 py-6 text-sm text-text-muted">
              Nenhuma entrada de estoque registrada ainda.
            </p>
          ) : (
            entradas.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-0.5 border-b border-border-subtle px-6 py-4 transition-colors last:border-b-0 hover:bg-surface-muted/70"
              >
                <span className="text-[13.5px] font-semibold text-foreground">
                  {e.epiNome}
                  {e.epiCa ? ` (C.A. ${e.epiCa})` : ""} · Qtd: {e.quantidade} ·{" "}
                  {formatMoney(e.precoUnitario)}/un.
                </span>
                <span className="text-xs text-text-secondary">
                  Compra em {formatDate(e.dataCompra)}
                  {e.fornecedor ? ` · ${e.fornecedor}` : ""}
                  {e.notaFiscal ? ` · NF ${e.notaFiscal}` : ""} · Registrado por{" "}
                  {e.registradoPorNome ?? "—"} em {formatDateTime(e.criadoEm)}
                </span>
              </div>
            ))
          )}
        </div>

        {totalEntradas > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <span className="text-[12.5px] text-text-secondary">
              Página {entradasPage} de {totalPaginasEntradas} · {totalEntradas}{" "}
              entrada{totalEntradas === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Link
                href={buildHref(filtros, { entradasPage: entradasPage - 1 })}
                aria-disabled={entradasPage <= 1}
                tabIndex={entradasPage <= 1 ? -1 : undefined}
                className={`rounded-lg border border-border-strong px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition ${
                  entradasPage <= 1
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-surface-muted"
                }`}
              >
                ← Anterior
              </Link>
              <Link
                href={buildHref(filtros, { entradasPage: entradasPage + 1 })}
                aria-disabled={entradasPage >= totalPaginasEntradas}
                tabIndex={entradasPage >= totalPaginasEntradas ? -1 : undefined}
                className={`rounded-lg border border-border-strong px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition ${
                  entradasPage >= totalPaginasEntradas
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-surface-muted"
                }`}
              >
                Próxima →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
