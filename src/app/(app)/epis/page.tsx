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

// Ícone vibrante do cabeçalho (mesmo tratamento do Dashboard/Colaboradores)
// — um "capacete" simplificado, de propósito genérico o bastante pra
// representar EPI como um todo (o catálogo tem 9 categorias diferentes).
function IconEpiHeader(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M4 14.5c0-5 3.5-9 8-9s8 4 8 9" />
      <path d="M2.5 14.5h19" />
      <path d="M2.5 14.5v2a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-2" />
      <path d="M12 5.5v-2" />
    </svg>
  );
}

// Um ícone pequeno e neutro por categoria de EPI (mesma lista fixa de
// TIPOS_EPI, ver epi-tipos.ts) — fica ao lado do nome do EPI, no lugar do
// "rostinho" que o Avatar dá pro colaborador (pedido do Rafael, 05/10/2026:
// "EPIs é a próxima tela natural... dá pra ganhar um ícone por categoria do
// mesmo jeito"). Diferente do Avatar, aqui a identidade é por FORMATO do
// ícone, não por cor: a paleta categórica (--chart-cat-1..5) só tem 5 cores
// e aqui são 9 categorias fixas — forçar 9 cores nela ia ou repetir cor (
// confundindo identidade) ou exigir cores novas fora do sistema já validado.
// Ícone sempre neutro (text-text-muted), igual ao resto dos ícones de célula
// da tabela — só o cabeçalho da página é vibrante, pelo mesmo motivo já
// documentado em colaboradores/page.tsx (vibrante repetido em toda linha
// vira "confete").
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

// v3 "bico de pato": a v1 original (abaulado, com "boquinha" sorrindo)
// lia como uma tigela de sopa a 16px (feedback do Rafael, 05/10/2026 —
// "esses ícones ficaram bem feios"). O contorno certo de um respirador
// tipo concha é o oposto: mais largo em cima (nariz) e afunilando pra um
// bico/ponta embaixo (queixo) — é essa silhueta "bico de pato" que o
// olho reconhece como máscara PFF2, não um oval genérico.
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

// v3 "X no peito": a v1 (mosquetão solto) lia como um balão numa
// vareta, e a v2 (pessoa com tiras retas nas pernas) ainda não deixava
// claro que era um arnês. Essa versão desenha a pessoa inteira com as
// tiras do talabarte cruzando em X sobre o peito — é essa faixa
// diagonal cruzada que identifica "proteção contra quedas" de cara.
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

// Fallback genérico pra EPI sem tipo definido ainda (campo fica em branco
// até alguém classificar — ver classificarTipoEpi em epi-tipos.ts).
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

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Abaixo desse limite de dias até o vencimento, o C.A. já aparece em alerta
// (laranja) em vez de esperar vencer de fato (vermelho) — dá tempo de agir.
// Mesmo prazo do card "CAs vencendo em 30 dias" do Dashboard (ver
// vw_ca_vencendo) — pedido do Rafael pra bater com o mesmo critério em
// toda a tela de EPIs: válido = verde, 30 dias ou menos = laranja, no dia
// do vencimento OU depois = vermelho (nunca fica mais um dia em laranja
// depois de vencido).
const LIMIAR_VENCIMENTO_DIAS = 30;

function statusCa(caValidade: string | null) {
  if (!caValidade) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(caValidade + "T00:00:00");
  const diffDias = Math.round(
    (validade.getTime() - hoje.getTime()) / 86_400_000,
  );

  if (diffDias <= 0) {
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
    className: "text-brand-700",
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
        icon={<IconEpiHeader className="h-5 w-5" />}
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

      {/* Tabela — só a partir de `xl` (1280px), mesmo critério e mesmo
          motivo de colaboradores/page.tsx (ver comentário lá): abaixo
          disso, mesmo com menos colunas que Colaboradores, ela não cabe de
          forma confiável sem rolar de lado em notebook com a janela não
          maximizada. Sem `min-w` fixo — a largura disponível de verdade
          quem decide, com o texto quebrando dentro da célula quando
          precisa. */}
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
                    <td className="px-2.5 py-[9px] text-[12.5px] font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <IconeDoTipo
                          tipo={e.tipo}
                          className="h-4 w-4 shrink-0 text-text-muted"
                        />
                        {e.nome}
                      </div>
                    </td>
                    <td className="px-2.5 py-[9px] text-[12.5px] text-foreground">
                      {e.tipo ?? "—"}
                    </td>
                    <td className="px-2.5 py-[9px] text-[12.5px] text-foreground">
                      {e.exigeCa ? (
                        <div>
                          <div>{e.ca ?? "—"}</div>
                          {ca && (
                            <div className={`text-[10px] ${ca.className}`}>
                              {ca.label}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted">Não exige C.A.</span>
                      )}
                    </td>
                    <td className="px-2.5 py-[9px] text-[12.5px] text-foreground">
                      {formatMoney(e.custoMedioAtual)}
                    </td>
                    <td className="px-2.5 py-[9px]">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          e.ativo
                            ? "bg-brand-100 text-brand-700"
                            : "bg-danger-bg text-danger-text"
                        }`}
                      >
                        {e.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-2.5 py-[9px] text-right">
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

      {/* Lista de cartões — telas abaixo de `xl` (ver comentário acima da
          tabela). Não precisa de ClickableCard aqui (diferente de
          Colaboradores): EPI não tem tela de detalhe pra abrir, o cartão é
          só uma versão empilhada da mesma linha, sem navegação. */}
      <div className="space-y-2 xl:hidden">
        {epis.length === 0 ? (
          <p className="rounded-2xl border border-border-subtle bg-surface px-4 py-6 text-center text-[13px] text-text-muted">
            Nenhum EPI encontrado.
          </p>
        ) : (
          epis.map((e) => {
            const ca = statusCa(e.caValidade);
            return (
              <div
                key={e.id}
                className="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconeDoTipo
                      tipo={e.tipo}
                      className="h-4 w-4 shrink-0 text-text-muted"
                    />
                    <span className="text-[13.5px] font-semibold text-foreground">
                      {e.nome}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                      e.ativo
                        ? "bg-brand-100 text-brand-700"
                        : "bg-danger-bg text-danger-text"
                    }`}
                  >
                    {e.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-secondary">
                  <span>{e.tipo ?? "Sem tipo definido"}</span>
                  <span>{formatMoney(e.custoMedioAtual)}</span>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
                  <div className="text-[11px] text-text-muted">
                    {e.exigeCa ? (
                      <span>
                        C.A. {e.ca ?? "—"}
                        {ca && (
                          <span className={`ml-1.5 ${ca.className}`}>
                            · {ca.label}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span>Não exige C.A.</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {podeGerenciar && <EditarEpiButton epi={e} />}
                    {podeGerenciar &&
                      (e.ativo ? (
                        <DesativarEpiButton epiId={e.id} epiNome={e.nome} />
                      ) : (
                        <ReativarEpiButton epiId={e.id} epiNome={e.nome} />
                      ))}
                    {podeExcluir && !e.ativo && (
                      <ExcluirEpiButton epiId={e.id} epiNome={e.nome} />
                    )}
                  </div>
                </div>
              </div>
            );
          })
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
