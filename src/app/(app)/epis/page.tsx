import Link from "next/link";
import { listEpis, EPIS_PAGE_SIZE } from "@/lib/data/epis";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { EpisFilters } from "./epis-filters";
import { NovoEpiButton } from "./novo-epi-button";
import { ImportarEpisButton } from "./importar-epis-button";
import { ClassificarTiposButton } from "./classificar-tipos-button";
import { EditarEpiButton } from "./editar-epi-button";
import { DesativarEpiButton } from "./desativar-epi-button";
import { ReativarEpiButton } from "./reativar-epi-button";
import { ExcluirEpiButton } from "./excluir-epi-button";
import { PageHeader } from "@/components/ui/page-header";
import { ListToolbar } from "@/components/ui/list-toolbar";

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Abaixo desse limite de dias até o vencimento, o C.A. já aparece com aviso
// (âmbar) em vez de esperar vencer de fato (vermelho) — dá tempo de agir.
const LIMIAR_VENCIMENTO_DIAS = 60;

function statusCa(caValidade: string | null) {
  if (!caValidade) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(caValidade + "T00:00:00");
  const diffDias = Math.round(
    (validade.getTime() - hoje.getTime()) / 86_400_000,
  );

  if (diffDias < 0) {
    return {
      label: `Vencido em ${formatDate(caValidade)}`,
      className: "text-danger-text",
    };
  }
  if (diffDias <= LIMIAR_VENCIMENTO_DIAS) {
    return {
      label: `Vence em ${formatDate(caValidade)}`,
      className: "text-warning-text",
    };
  }
  return {
    label: `Válido até ${formatDate(caValidade)}`,
    className: "text-text-muted",
  };
}

type SortKey = "nome" | "tipo" | "custo_medio" | "status";

const COLUNAS: { label: string; sortKey: SortKey | null }[] = [
  { label: "EPI", sortKey: "nome" },
  { label: "Tipo", sortKey: "tipo" },
  { label: "C.A.", sortKey: null },
  { label: "Custo médio", sortKey: "custo_medio" },
  { label: "Status", sortKey: "status" },
  { label: "", sortKey: null },
];

function buildHref(
  q: string | undefined,
  tipo: string | undefined,
  status: string | undefined,
  sort: string | undefined,
  dir: string | undefined,
  page: number,
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tipo) params.set("tipo", tipo);
  if (status) params.set("status", status);
  if (sort) params.set("sort", sort);
  if (dir) params.set("dir", dir);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/epis${qs ? `?${qs}` : ""}`;
}

/**
 * Exportação respeita os mesmos filtros e a mesma ordenação aplicados na
 * tela (busca, tipo, status, coluna), mas nunca a paginação — o CSV sempre
 * traz o catálogo inteiro que bate com o filtro, não só os 20 EPIs da
 * página visível.
 */
function buildExportHref(
  q: string | undefined,
  tipo: string | undefined,
  status: string | undefined,
  sort: string | undefined,
  dir: string | undefined,
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tipo) params.set("tipo", tipo);
  if (status) params.set("status", status);
  if (sort) params.set("sort", sort);
  if (dir) params.set("dir", dir);
  const qs = params.toString();
  return `/epis/export${qs ? `?${qs}` : ""}`;
}

/**
 * Clicar num cabeçalho de coluna ordena por ela; clicar de novo inverte a
 * direção. Trocar a ordenação sempre volta pra página 1.
 */
function buildSortHref(
  q: string | undefined,
  tipo: string | undefined,
  status: string | undefined,
  sortAtual: string,
  dirAtual: string,
  coluna: SortKey,
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tipo) params.set("tipo", tipo);
  if (status) params.set("status", status);
  const proximaDir = sortAtual === coluna && dirAtual !== "desc" ? "desc" : "asc";
  params.set("sort", coluna);
  params.set("dir", proximaDir);
  return `/epis?${params.toString()}`;
}

export default async function EpisPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    tipo?: string;
    status?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const { q, tipo, status, sort, dir, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const sortAtual = sort ?? "nome";
  const dirAtual = dir ?? "asc";

  // Precisa da empresa do usuário logado ANTES de buscar os EPIs (listEpis
  // agora filtra por empresa, ver lib/data/epis.ts) — não dá mais pra
  // buscar os dois em paralelo com Promise.all como antes.
  const user = await getCurrentUser();
  const { epis, total } = await listEpis({
    empresaId: user?.empresaId ?? null,
    query: q,
    tipo,
    status,
    sort,
    dir,
    page,
  });

  const totalPages = Math.max(1, Math.ceil(total / EPIS_PAGE_SIZE));

  // Mesma regra de colaboradores: "encarregado"+ cadastra/edita/desativa/
  // exporta — desativar um EPI do catálogo não tem peso trabalhista, então
  // não precisa do nível extra "admin" (ver comentário em actions.ts).
  // Import e exclusão definitiva são exceção: mesmo aqui, onde as outras
  // ações ficam em "encarregado", essas duas exigem "admin" — uma planilha
  // ou mapeamento errado bagunça o catálogo inteiro de uma vez, e excluir
  // não tem volta (diferente de desativar, que tem reativar). O botão de
  // excluir só aparece pra EPI já desativado (ver coluna de ações da
  // tabela). As Server Actions e a rota de export fazem a mesma checagem de
  // novo; esconder o botão aqui nunca é a única barreira.
  const podeGerenciar = temPapelMinimo(user?.papel, "encarregado");
  const podeImportar = temPapelMinimo(user?.papel, "admin");
  const podeExcluir = temPapelMinimo(user?.papel, "admin");

  return (
    <div className="space-y-1">
      <PageHeader
        title="EPIs homologados"
        description="Cadastro mestre de EPI, com C.A. e custo médio."
      />

      <ListToolbar
        filters={<EpisFilters />}
        actions={
          podeGerenciar && (
            <>
              <a
                href={buildExportHref(q, tipo, status, sort, dir)}
                title="Exportar catálogo filtrado em CSV"
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
              {podeImportar && <ImportarEpisButton />}
              {podeImportar && <ClassificarTiposButton />}
              <NovoEpiButton />
            </>
          )
        }
      />

      <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
        <table className="w-full min-w-[680px] border-collapse bg-surface text-left">
          <thead>
            <tr>
              {COLUNAS.map((coluna) => (
                <th
                  key={coluna.label || "acoes"}
                  className="border-b border-border-subtle bg-surface-muted px-4 py-3.5 text-[11px] font-semibold tracking-[0.04em] text-text-secondary uppercase"
                >
                  {coluna.sortKey ? (
                    <Link
                      href={buildSortHref(
                        q,
                        tipo,
                        status,
                        sortAtual,
                        dirAtual,
                        coluna.sortKey,
                      )}
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
            {epis.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-text-muted">
                  Nenhum EPI encontrado.
                </td>
              </tr>
            ) : (
              epis.map((e) => {
                const ca = statusCa(e.caValidade);
                return (
                  <tr
                    key={e.id}
                    className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-muted/70"
                  >
                    <td className="px-4 py-3.5 text-[13.5px] font-medium text-foreground">
                      {e.nome}
                    </td>
                    <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                      {e.tipo ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                      {e.exigeCa ? (
                        <div>
                          <div>{e.ca ?? "—"}</div>
                          {ca && (
                            <div className={`text-[11px] ${ca.className}`}>
                              {ca.label}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted">Não exige C.A.</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                      {formatMoney(e.custoMedioAtual)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          e.ativo
                            ? "bg-brand-100 text-brand-700"
                            : "bg-danger-bg text-danger-text"
                        }`}
                      >
                        {e.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {podeGerenciar && <EditarEpiButton epi={e} />}
                        {podeGerenciar &&
                          (e.ativo ? (
                            <DesativarEpiButton
                              epiId={e.id}
                              epiNome={e.nome}
                            />
                          ) : (
                            <ReativarEpiButton epiId={e.id} epiNome={e.nome} />
                          ))}
                        {podeExcluir && !e.ativo && (
                          <ExcluirEpiButton epiId={e.id} epiNome={e.nome} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
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
              href={buildHref(q, tipo, status, sort, dir, page - 1)}
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
              href={buildHref(q, tipo, status, sort, dir, page + 1)}
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
  );
}
