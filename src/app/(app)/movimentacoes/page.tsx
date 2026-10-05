import Link from "next/link";
import {
  listMovimentacoes,
  listColaboradoresAtivos,
  listEpisAtivos,
  listColaboradoresParaFiltro,
  listEpisParaFiltro,
  MOVIMENTACOES_PAGE_SIZE,
  type TipoMovimentacao,
} from "@/lib/data/movimentacoes";
import { getCurrentUser } from "@/lib/data/current-user";
import { listEstacoesAtivas } from "@/lib/data/estacoes-assinatura";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { PageHeader } from "@/components/ui/page-header";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { MovimentacoesFilters } from "./movimentacoes-filters";
import { RegistrarEntregaButton } from "./registrar-entrega-button";
import { RegistrarDevolucaoButton } from "./registrar-devolucao-button";
import { RegistrarRecusaButton } from "./registrar-recusa-button";

const TIPO_LABEL: Record<TipoMovimentacao, string> = {
  entrega: "Entrega",
  devolucao: "Devolução",
  recusa: "Recusa",
};

const DOT_CLASS: Record<TipoMovimentacao, string> = {
  entrega: "bg-brand-600",
  devolucao: "bg-text-muted",
  recusa: "bg-warning-text",
};

// Ícone vibrante do cabeçalho (mesmo tratamento de Dashboard/Colaboradores/
// EPIs) — setas cruzadas representando entrada e saída de EPI do estoque,
// o resumo visual do que a tela mostra (entrega/devolução/recusa).
function IconMovimentacoesHeader(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M4 7h13" />
      <path d="M13 3.5 17 7l-4 3.5" />
      <path d="M20 17H7" />
      <path d="M11 13.5 7 17l4 3.5" />
    </svg>
  );
}

// Mesmo ícone pequeno e neutro por categoria de EPI da tela de EPIs
// homologados (ver IconeDoTipo em epis/page.tsx — mesmas 9 categorias
// fixas de TIPOS_EPI, mesma razão pra usar FORMATO em vez de cor: a
// paleta categórica só tem 5 slots). Copiado aqui (em vez de importado)
// porque cada tela de listagem deste projeto é um arquivo autocontido —
// mesma escolha já feita ao construir epis/page.tsx. Pedido do Rafael,
// 05/10/2026: aplicar o mesmo padrão visual na tela de Movimentações.
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

const ICONE_POR_TIPO_EPI: Record<string, (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element> = {
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

function IconeDoTipoEpi({
  tipo,
  className,
}: {
  tipo: string | null;
  className?: string;
}) {
  const Icon = (tipo && ICONE_POR_TIPO_EPI[tipo]) || IconTipoGenerico;
  return <Icon className={className} />;
}

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function isTipo(value: string | undefined): value is TipoMovimentacao {
  return value === "entrega" || value === "devolucao" || value === "recusa";
}

function buildHref(
  tipo: string | undefined,
  colaborador: string | undefined,
  epi: string | undefined,
  de: string | undefined,
  ate: string | undefined,
  page: number,
) {
  const params = new URLSearchParams();
  if (tipo) params.set("tipo", tipo);
  if (colaborador) params.set("colaborador", colaborador);
  if (epi) params.set("epi", epi);
  if (de) params.set("de", de);
  if (ate) params.set("ate", ate);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/movimentacoes${qs ? `?${qs}` : ""}`;
}

/**
 * Exportação respeita os mesmos filtros aplicados na tela (tipo, colaborador,
 * EPI, período), mas nunca a paginação — o CSV sempre traz tudo que bate com
 * o filtro, não só os 20 eventos da página visível.
 */
function buildExportHref(
  tipo: string | undefined,
  colaborador: string | undefined,
  epi: string | undefined,
  de: string | undefined,
  ate: string | undefined,
) {
  const params = new URLSearchParams();
  if (tipo) params.set("tipo", tipo);
  if (colaborador) params.set("colaborador", colaborador);
  if (epi) params.set("epi", epi);
  if (de) params.set("de", de);
  if (ate) params.set("ate", ate);
  const qs = params.toString();
  return `/movimentacoes/export${qs ? `?${qs}` : ""}`;
}

export default async function MovimentacoesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    colaborador?: string;
    epi?: string;
    de?: string;
    ate?: string;
    page?: string;
  }>;
}) {
  const {
    tipo,
    colaborador,
    epi,
    de,
    ate,
    page: pageParam,
  } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const tipoFiltro = isTipo(tipo) ? tipo : undefined;

  // listMovimentacoes e as listas de apoio agora filtram por empresa (ver
  // lib/data/movimentacoes.ts) — precisam do usuário logado antes, então
  // buscamos ele primeiro e só então disparamos o resto em paralelo.
  const user = await getCurrentUser();
  const empresaId = user?.empresaId ?? null;

  const [
    { eventos, total },
    colaboradoresAtivos,
    episAtivos,
    colaboradoresFiltro,
    episFiltro,
  ] = await Promise.all([
    listMovimentacoes({
      empresaId,
      tipo: tipoFiltro,
      colaboradorId: colaborador,
      epiId: epi,
      dataInicio: de,
      dataFim: ate,
      page,
    }),
    listColaboradoresAtivos(empresaId),
    listEpisAtivos(empresaId),
    listColaboradoresParaFiltro(empresaId),
    listEpisParaFiltro(empresaId),
  ]);

  // listEstacoesAtivas agora filtra por empresa (ver estacoes-assinatura.ts)
  const estacoesAtivas = await listEstacoesAtivas(empresaId);

  const totalPages = Math.max(1, Math.ceil(total / MOVIMENTACOES_PAGE_SIZE));

  // Mesmo nível de colaboradores/EPIs: "encarregado"+ registra entrega,
  // devolução e recusa — não é uma ação mais sensível que cadastrar um
  // colaborador ou um EPI. Não existe edição de movimentação: é um
  // histórico imutável por design. A única exceção é exclusão de ENTREGA,
  // reservada a super_admin e só para corrigir lançamento de teste (ver
  // excluirEntregaTeste em actions.ts) — mas o botão não mora aqui: esta
  // tela filtra tudo por user.empresaId, e super_admin nunca tem
  // empresa_id (RLS de `entregas` isola por auth_empresa_id(), que
  // retornaria null pra ele), então essa página sempre mostraria lista
  // vazia pra essa conta. O botão fica em /empresas/[id] (super_admin
  // acessa por lá, escolhendo a empresa pela URL, com client admin — ver
  // listEntregasRecentesEmpresa em lib/data/movimentacoes.ts).
  const podeGerenciar = temPapelMinimo(user?.papel, "encarregado");

  return (
    <div className="space-y-1">
      <PageHeader
        title="Movimentações"
        description="Entregas, devoluções e recusas de EPI — histórico completo, mais recente primeiro."
        icon={<IconMovimentacoesHeader className="h-5 w-5" />}
      />

      <ListToolbar
        filters={
          <MovimentacoesFilters
            colaboradores={colaboradoresFiltro}
            epis={episFiltro}
          />
        }
        actions={
          podeGerenciar && (
            <>
              <a
                href={buildExportHref(tipo, colaborador, epi, de, ate)}
                title="Exportar lista filtrada em CSV"
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
              <RegistrarRecusaButton
                colaboradores={colaboradoresAtivos}
                epis={episAtivos}
              />
              <RegistrarDevolucaoButton colaboradores={colaboradoresAtivos} />
              <RegistrarEntregaButton
                colaboradores={colaboradoresAtivos}
                epis={episAtivos}
                estacoes={estacoesAtivas}
              />
            </>
          )
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-card">
        {eventos.length === 0 ? (
          <p className="px-6 py-6 text-sm text-text-muted">
            Nenhuma movimentação encontrada.
          </p>
        ) : (
          eventos.map((evento) => (
            <div
              key={evento.id}
              className="flex gap-3.5 border-b border-border-subtle px-6 py-4 transition-colors last:border-b-0 hover:bg-surface-muted/70"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[evento.tipo]}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
                    <IconeDoTipoEpi
                      tipo={evento.epiTipo}
                      className="h-3.5 w-3.5 shrink-0 text-text-muted"
                    />
                    {TIPO_LABEL[evento.tipo]} — {evento.epiNome}
                    {evento.epiCa ? ` (C.A. ${evento.epiCa})` : ""}
                    {evento.quantidade ? ` · Qtd: ${evento.quantidade}` : ""}
                  </span>
                  <Link
                    href={`/colaboradores/${evento.colaboradorId}`}
                    className="text-[12.5px] font-semibold text-brand-700 hover:underline"
                  >
                    {evento.colaboradorNome}
                  </Link>
                </div>
                <div className="mt-0.5 text-xs text-text-secondary">
                  {formatDate(evento.data)}
                  {evento.hora ? ` às ${evento.hora}` : ""} ·{" "}
                  {evento.motivoLabel}
                  {evento.detalhe ? ` · ${evento.detalhe}` : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="text-[12.5px] text-text-secondary">
            Página {page} de {totalPages} · {total} movimentaç
            {total === 1 ? "ão" : "ões"}
          </span>
          <div className="flex gap-2">
            <Link
              href={buildHref(tipo, colaborador, epi, de, ate, page - 1)}
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
              href={buildHref(tipo, colaborador, epi, de, ate, page + 1)}
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
