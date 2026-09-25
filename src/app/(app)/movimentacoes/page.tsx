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

  const [
    { eventos, total },
    colaboradoresAtivos,
    episAtivos,
    colaboradoresFiltro,
    episFiltro,
    user,
    estacoesAtivas,
  ] = await Promise.all([
    listMovimentacoes({
      tipo: tipoFiltro,
      colaboradorId: colaborador,
      epiId: epi,
      dataInicio: de,
      dataFim: ate,
      page,
    }),
    listColaboradoresAtivos(),
    listEpisAtivos(),
    listColaboradoresParaFiltro(),
    listEpisParaFiltro(),
    getCurrentUser(),
    listEstacoesAtivas(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / MOVIMENTACOES_PAGE_SIZE));

  // Mesmo nível de colaboradores/EPIs: "encarregado"+ registra entrega,
  // devolução e recusa — não é uma ação mais sensível que cadastrar um
  // colaborador ou um EPI. Não existe edição nem exclusão de movimentação
  // (ver actions.ts): é um histórico imutável, então não há uma ação de
  // nível "admin" aqui.
  const podeGerenciar = temPapelMinimo(user?.papel, "encarregado");

  return (
    <div className="space-y-1">
      <PageHeader
        title="Movimentações"
        description="Entregas, devoluções e recusas de EPI — histórico completo, mais recente primeiro."
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

      <div className="overflow-hidden rounded-[14px] border border-border-subtle bg-surface">
        {eventos.length === 0 ? (
          <p className="px-6 py-6 text-sm text-text-muted">
            Nenhuma movimentação encontrada.
          </p>
        ) : (
          eventos.map((evento) => (
            <div
              key={evento.id}
              className="flex gap-3.5 border-b border-border-subtle px-6 py-4 last:border-b-0"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[evento.tipo]}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[13.5px] font-semibold text-foreground">
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
