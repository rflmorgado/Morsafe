import Link from "next/link";
import {
  apurarAuditoriaRegistros,
  type EpiAuditoria,
} from "@/lib/data/auditoria-registros";
import { Card } from "@/components/ui/card";
import { AvisosBanner } from "./avisos-banner";

// Mesmo tamanho de página da listagem principal de EPIs (EPIS_PAGE_SIZE, em
// lib/data/epis.ts) e da aba Colaboradores desta mesma tela — pedido do
// Rafael, 05/10/2026: a lista inteira ficava enorme numa página só. A
// apuração continua buscando/ordenando TUDO de uma vez (ver
// apurarAuditoriaRegistros); só o recorte de 20 em 20 acontece aqui.
const EPIS_TAB_PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

// Pessoas (duas silhuetas) — mesma leitura de "quantidade de gente" usada em
// outras telas, aqui pra "quantos colaboradores estão de posse deste EPI".
function IconUsersSmall(props: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.8 6-5.8s6 2.5 6 5.8" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 6.1" />
      <path d="M18.5 14.6c2.3.6 4 2.6 4 5.4" />
    </svg>
  );
}

const STATUS_CA_STYLE: Record<
  EpiAuditoria["statusCa"],
  { label: string; className: string }
> = {
  ok: { label: "C.A. válido", className: "bg-brand-100 text-brand-700" },
  vencendo: {
    label: "C.A. vencendo",
    className: "bg-warning-bg text-warning-text",
  },
  vencido: { label: "C.A. vencido", className: "bg-danger-bg text-danger-text" },
  sem_ca: {
    label: "C.A. incompleto",
    className: "bg-danger-bg text-danger-text",
  },
  nao_exige: {
    label: "Não exige C.A.",
    className: "bg-surface-muted text-text-muted",
  },
};

/**
 * "EPIs" — mesma apuração das demais abas (ver apurarAuditoriaRegistros),
 * organizada por ITEM: pra cada EPI ativo, o status do C.A. (mesmos
 * limiares de epis/page.tsx — vence em até 30 dias = "vencendo") e quantos
 * colaboradores ativos estão DE POSSE dele hoje (entrega sem devolução
 * depois — mesmo cálculo da Visão geral). Pedido do Rafael, 06/10/2026
 * ("auditoria dos EPIs").
 *
 * EPI não tem página de detalhe própria no sistema — o link de cada item
 * leva pra lista de EPIs já filtrada pelo nome (/epis?q=), igual o padrão
 * já usado nas Pendências.
 *
 * Paginação (20 por página) e tabela sem truncate: mesmo ajuste e mesmo
 * motivo da aba Colaboradores (ver comentário na tabela abaixo e em
 * colaboradores-tab.tsx) — pedido do Rafael, 05/10/2026.
 */
export async function EpisTab({
  empresaId,
  pagina,
}: {
  empresaId: string | null;
  pagina: number;
}) {
  const apuracao = await apurarAuditoriaRegistros(empresaId);
  const total = apuracao.episDetalhe.length;

  if (total === 0) {
    return (
      <div>
        <AvisosBanner avisos={apuracao.avisos} />
        <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
          Nenhum EPI ativo cadastrado ainda.
        </p>
      </div>
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(total / EPIS_TAB_PAGE_SIZE));
  const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (paginaAtual - 1) * EPIS_TAB_PAGE_SIZE;
  const episPagina = apuracao.episDetalhe.slice(
    inicio,
    inicio + EPIS_TAB_PAGE_SIZE,
  );

  return (
    <div>
      <AvisosBanner avisos={apuracao.avisos} />

      {/* Tabela — só a partir de `xl`, mesmo limite usado no resto do app.
          Nome do EPI SEM truncate: numa tabela sem table-layout: fixed, o
          max-width num <td> não limita de verdade a largura da coluna (o
          navegador dimensiona pelo conteúdo), então um nome comprido
          "vazava" visualmente por cima da coluna ao lado em vez de cortar
          — mesmo problema e mesma solução já aplicada em
          colaboradores-tab.tsx e colaboradores/page.tsx (ver comentário
          lá): deixar o texto quebrar dentro da célula em vez de truncar. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card xl:block">
        <table className="w-full border-collapse bg-surface text-left">
          <thead>
            <tr>
              {["EPI", "C.A.", "Situação", "Colaboradores com o EPI"].map(
                (label) => (
                  <th
                    key={label}
                    className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {episPagina.map((e) => {
              const estilo = STATUS_CA_STYLE[e.statusCa];
              return (
                <tr key={e.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-2.5 py-[9px] text-[12.5px] font-medium text-foreground">
                    <Link
                      href={`/epis?q=${encodeURIComponent(e.nome)}`}
                      className="hover:underline"
                    >
                      {e.nome}
                    </Link>
                  </td>
                  <td className="px-2.5 py-[9px] text-[12.5px] text-text-secondary">
                    {e.ca ? (
                      <span>
                        {e.ca}
                        {e.caValidade && (
                          <span className="text-text-muted">
                            {" "}
                            · vence {formatDate(e.caValidade)}
                          </span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2.5 py-[9px]">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${estilo.className}`}
                    >
                      {estilo.label}
                    </span>
                  </td>
                  <td className="px-2.5 py-[9px] text-[12.5px] text-text-secondary">
                    <span className="inline-flex items-center gap-1.5">
                      <IconUsersSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      {e.colaboradoresComPosse}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Lista de cartões — abaixo de `xl`. Aqui o truncate continua
          funcionando normalmente: é flexbox (min-w-0 + truncate), não
          tabela, então não tem o problema acima. */}
      <div className="space-y-2 xl:hidden">
        {episPagina.map((e) => {
          const estilo = STATUS_CA_STYLE[e.statusCa];
          return (
            <Card key={e.id}>
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/epis?q=${encodeURIComponent(e.nome)}`}
                  className="min-w-0 truncate text-[13.5px] font-semibold text-foreground hover:underline"
                >
                  {e.nome}
                </Link>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${estilo.className}`}
                >
                  {estilo.label}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-secondary">
                {e.ca && (
                  <span>
                    C.A. {e.ca}
                    {e.caValidade && ` · vence ${formatDate(e.caValidade)}`}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <IconUsersSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  {e.colaboradoresComPosse} colaborador
                  {e.colaboradoresComPosse === 1 ? "" : "es"}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <span className="text-[12.5px] text-text-secondary">
          Página {paginaAtual} de {totalPaginas} · {total} EPI
          {total === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          <Link
            href={`/auditoria?aba=epis&pagina=${paginaAtual - 1}`}
            aria-disabled={paginaAtual <= 1}
            tabIndex={paginaAtual <= 1 ? -1 : undefined}
            className={`rounded-lg border border-border-strong px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition ${
              paginaAtual <= 1
                ? "pointer-events-none opacity-40"
                : "hover:bg-surface-muted"
            }`}
          >
            ← Anterior
          </Link>
          <Link
            href={`/auditoria?aba=epis&pagina=${paginaAtual + 1}`}
            aria-disabled={paginaAtual >= totalPaginas}
            tabIndex={paginaAtual >= totalPaginas ? -1 : undefined}
            className={`rounded-lg border border-border-strong px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition ${
              paginaAtual >= totalPaginas
                ? "pointer-events-none opacity-40"
                : "hover:bg-surface-muted"
            }`}
          >
            Próxima →
          </Link>
        </div>
      </div>

      <p className="mt-3 text-center text-[12px] text-text-muted sm:text-left">
        <Link
          href="/epis"
          className="font-semibold text-brand-700 hover:underline"
        >
          Ver todos os EPIs →
        </Link>
      </p>
    </div>
  );
}
