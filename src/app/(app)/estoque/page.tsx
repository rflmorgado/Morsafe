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

// Ícone vibrante do cabeçalho (mesmo tratamento de Dashboard/Colaboradores/
// EPIs/Movimentações/Estações/Empresa/Usuários) — uma caixa em perspectiva
// isométrica, o símbolo universal de estoque/inventário.
function IconEstoqueHeader(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" />
      <path d="M3.5 7.5 12 12l8.5-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

// Mesmo conjunto de ícones por categoria de EPI de epis/page.tsx/
// movimentacoes/page.tsx — duplicado aqui (convenção já adotada nas outras
// telas: cada arquivo de tela fica autocontido, sem um módulo compartilhado
// só pra isso). Fica ao lado do nome do EPI na coluna "EPI" e em cada
// entrada do histórico de compras, mesmo tratamento neutro (text-text-muted)
// de ícone de célula — só o cabeçalho da página é vibrante.
function IconCapacete(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 15.2c0-4.5 3.5-8 8-8s8 3.5 8 8" />
      <ellipse cx="12" cy="15.2" rx="9.7" ry="1.9" />
      <path d="M12 7.2V5" />
    </svg>
  );
}

function IconAuricular(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4.5 13.6v-1.8a7.5 7.5 0 0 1 15 0v1.8" />
      <rect x="2.3" y="12.6" width="4.4" height="7.4" rx="2.2" />
      <rect x="17.3" y="12.6" width="4.4" height="7.4" rx="2.2" />
    </svg>
  );
}

function IconOculos(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 10.8c0-1.1.9-1.8 2-1.8h14c1.1 0 2 .7 2 1.8v2.4c0 2.3-2.2 3.8-5.3 3.8-2.1 0-3.6-1-4.2-2.6-.6 1.6-2.1 2.6-4.2 2.6-3.1 0-5.3-1.5-5.3-3.8Z" />
      <path d="M9.3 11.8h5.4" />
    </svg>
  );
}

function IconRespirador(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4.5 9.5c0-.9.6-1.6 1.6-1.9C8.3 7 10 6.7 12 6.7s3.7.3 5.9 1c1 .3 1.6 1 1.6 1.9 0 3.6-1.3 6.4-3.3 8.1-1.5 1.3-3 1.9-4.2 1.9s-2.7-.6-4.2-1.9c-2-1.7-3.3-4.5-3.3-8.1Z" />
      <path d="M6.7 10.3c2.3-.9 8.3-.9 10.6 0M6.7 12.6c2.3-.9 8.3-.9 10.6 0" />
      <path d="M4.7 9.2 2.1 7.8M19.3 9.2l2.6-1.4" />
    </svg>
  );
}

function IconLuva(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 20v-8.6a1.6 1.6 0 0 1 3.2 0v-2a1.6 1.6 0 0 1 3.2 0v1.8a1.6 1.6 0 0 1 3.2 0V15c0 2.8-2 5-5 5Z" />
      <path d="M8 13.4c-1.6-.2-2.8-1.3-2.8-2.9V9a1.6 1.6 0 0 1 3.2 0v2.6" />
      <path d="M8 20h7.6" />
    </svg>
  );
}

function IconBota(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9.5 3v7.6L5 13.3a3 3 0 0 0-1.5 2.6v1.6h17c0-2.5-1.7-3.9-4.2-4.5l-4.3-1V3Z" />
      <path d="M9.5 6.8h3.5" />
      <path d="M3.3 17.5h17.4" />
    </svg>
  );
}

function IconColete(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 4 6.3 6.2v13.3h4.2l.8-9.3h1.4l.8 9.3h4.2V6.2L14.8 4" />
      <path d="M9 4c.9 1.3 1.9 2 3 2s2.1-.7 3-2" />
      <path d="M7.2 13.5h2.6M14.2 13.5h2.6" />
    </svg>
  );
}

function IconQuedas(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="4.2" r="2" />
      <path d="M8 8.2 12 6.2l4 2" />
      <path d="M9 7l6 7M15 7l-6 7" />
      <path d="M9.5 20l1-6M14.5 20l-1-6" />
    </svg>
  );
}

function IconTermica(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2.8c2.3 3 .3 4-1 6.4-1 2 .3 4 1.8 4 1.8 0 2.8-1.5 2.4-3.4 1.4 1.5 2.3 3.2 2.3 5a5.5 5.5 0 1 1-11 0c0-3.6 2.3-6.2 5.5-12Z" />
    </svg>
  );
}

function IconTipoGenerico(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3.5 19 6.5v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10v-5Z" />
    </svg>
  );
}

const ICONE_POR_TIPO: Record<string, (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  "Proteção da cabeça": IconCapacete,
  "Proteção auditiva": IconAuricular,
  "Proteção visual": IconOculos,
  "Proteção respiratória": IconRespirador,
  "Proteção das mãos": IconLuva,
  "Proteção dos pés": IconBota,
  "Proteção do corpo": IconColete,
  "Proteção contra quedas": IconQuedas,
  "Proteção térmica": IconTermica,
};

function IconeDoTipo({
  tipo,
  className,
}: {
  tipo: string | null;
  className?: string;
}) {
  const Icon = (tipo && ICONE_POR_TIPO[tipo]) || IconTipoGenerico;
  return <Icon className={className} />;
}

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
          icon={<IconEstoqueHeader className="h-5 w-5" />}
        />

        <ListToolbar
          filters={<EstoqueFilters />}
          actions={
            <>
              {/* Visível pra qualquer papel que acesse /estoque (inclusive
                  "leitura") — é só uma lista derivada do saldo atual, sem
                  nenhuma ação de escrita nela mesma (exportar é que exige
                  "encarregado"+, checado dentro da própria tela/rota). */}
              <a
                href="/estoque/reposicao"
                title="Ver itens com saldo abaixo do limite de alerta"
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
                  <circle cx="9" cy="20" r="1.4" />
                  <circle cx="17.5" cy="20" r="1.4" />
                  <path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7.5H6" />
                </svg>
                Itens para repor estoque
              </a>
              {podeGerenciar && (
                <>
                  {podeImportar && (
                    <>
                      <ImportarCatalogoEstoqueButton epis={episAtivos} />
                      <ImportarEstoqueButton epis={episAtivos} />
                    </>
                  )}
                  <RegistrarEntradaButton epis={episAtivos} />
                </>
              )}
            </>
          }
        />

        {/* Tabela — só a partir de `xl` (1280px), mesmo critério de
            Colaboradores/EPIs/Movimentações/Estações/Usuários (ver
            comentário em usuarios/page.tsx): abaixo disso ela não cabe de
            forma confiável sem rolar de lado — aqui com 7 colunas (uma a
            mais que EPIs), por isso o padding/fonte mais compactos (mesmo
            tratamento já usado em epis/page.tsx). Sem `min-w` fixo (removido
            o antigo `min-w-[760px]`) — é a largura disponível de verdade
            quem decide o tamanho das colunas. */}
        <div className="hidden overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card xl:block">
          <table className="w-full border-collapse bg-surface text-left">
            <thead>
              <tr>
                {COLUNAS.map((coluna) => (
                  <th
                    key={coluna.label || "acoes"}
                    className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase"
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
                      item.statusEstoque === "critico"
                        ? "bg-danger-bg/30"
                        : item.statusEstoque === "alerta"
                          ? "bg-warning-bg/30"
                          : ""
                    }`}
                  >
                    <td className="max-w-[160px] px-2.5 py-[9px] text-[12.5px] font-medium text-foreground">
                      <div className="flex min-w-0 items-center gap-2">
                        <IconeDoTipo
                          tipo={item.tipo}
                          className="h-4 w-4 shrink-0 text-text-muted"
                        />
                        <span className="min-w-0 truncate" title={item.nome}>
                          {item.nome}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-[172px] px-2.5 py-[9px] text-[12.5px] text-foreground">
                      <span className="block truncate" title={item.tipo ?? undefined}>
                        {item.tipo ?? "—"}
                      </span>
                    </td>
                    <td className="px-2.5 py-[9px] text-[12.5px] text-foreground">
                      {item.ca ?? "—"}
                    </td>
                    <td className="px-2.5 py-[9px] text-[12.5px]">
                      {/* Rótulo de status embaixo do número, não ao lado —
                          inline ("Estoque crítico" ao lado do saldo) empurrava
                          a coluna larga o bastante pra estourar os 820px
                          disponíveis a `xl` com 7 colunas (mesma lição de
                          usuarios/page.tsx: competir por largura na horizontal
                          é o que mais facilmente derruba esse layout). */}
                      <div
                        className={
                          item.statusEstoque === "critico"
                            ? "font-semibold text-danger-text"
                            : item.statusEstoque === "alerta"
                              ? "font-semibold text-warning-text"
                              : "text-brand-700"
                        }
                      >
                        {item.saldoAtual}
                      </div>
                      {item.statusEstoque === "critico" && (
                        <div className="text-[10px] font-semibold text-danger-text">
                          Estoque crítico
                        </div>
                      )}
                      {item.statusEstoque === "alerta" && (
                        <div className="text-[10px] font-semibold text-warning-text">
                          No limite mínimo
                        </div>
                      )}
                    </td>
                    <td className="px-2.5 py-[9px] text-[12.5px] text-foreground">
                      {item.limiteAlerta}
                    </td>
                    <td className="px-2.5 py-[9px] text-[12.5px] text-foreground">
                      {formatMoney(item.custoMedioAtual)}
                    </td>
                    <td className="px-2.5 py-[9px] text-right">
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

        {/* Lista de cartões — telas abaixo de `xl` (ver comentário acima da
            tabela). */}
        <div className="space-y-2 xl:hidden">
          {itens.length === 0 ? (
            <p className="rounded-2xl border border-border-subtle bg-surface px-4 py-6 text-center text-[13px] text-text-muted">
              Nenhum EPI ativo encontrado.
            </p>
          ) : (
            itens.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card ${
                  item.statusEstoque === "critico"
                    ? "bg-danger-bg/20"
                    : item.statusEstoque === "alerta"
                      ? "bg-warning-bg/20"
                      : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconeDoTipo
                      tipo={item.tipo}
                      className="h-4 w-4 shrink-0 text-text-muted"
                    />
                    <span className="truncate text-[13.5px] font-semibold text-foreground">
                      {item.nome}
                    </span>
                  </div>
                  {podeGerenciar && (
                    <EditarLimiteButton
                      epiId={item.id}
                      epiNome={item.nome}
                      limiteAtual={item.limiteAlerta}
                    />
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-secondary">
                  <span>{item.tipo ?? "Sem tipo definido"}</span>
                  <span>C.A. {item.ca ?? "—"}</span>
                  <span>{formatMoney(item.custoMedioAtual)}</span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
                  <span
                    className={`text-[12.5px] font-semibold ${
                      item.statusEstoque === "critico"
                        ? "text-danger-text"
                        : item.statusEstoque === "alerta"
                          ? "text-warning-text"
                          : "text-brand-700"
                    }`}
                  >
                    Saldo: {item.saldoAtual}
                    <span className="font-normal text-text-secondary">
                      {" "}
                      / limite {item.limiteAlerta}
                    </span>
                  </span>
                  {item.statusEstoque === "critico" && (
                    <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[10.5px] font-semibold text-danger-text">
                      Estoque crítico
                    </span>
                  )}
                  {item.statusEstoque === "alerta" && (
                    <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[10.5px] font-semibold text-warning-text">
                      No limite mínimo
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
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
                className="flex items-start gap-2.5 border-b border-border-subtle px-6 py-4 transition-colors last:border-b-0 hover:bg-surface-muted/70"
              >
                <IconeDoTipo
                  tipo={e.epiTipo}
                  className="mt-0.5 h-4 w-4 shrink-0 text-text-muted"
                />
                <div className="flex min-w-0 flex-col gap-0.5">
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
