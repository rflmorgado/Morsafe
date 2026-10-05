import Link from "next/link";
import {
  listSetoresComStatusAuditoria,
  countCaVencendo,
} from "@/lib/data/auditorias-nr06";
import { contarNaoConformidades } from "@/lib/data/auditorias-nr06-perguntas";
import { getNr06StatusCounts } from "@/lib/data/colaboradores";
import type { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { Card } from "@/components/ui/card";
import { ClickableRow } from "@/components/ui/clickable-row";
import { ClickableCard } from "@/components/ui/clickable-card";
import { RodarAuditoriaButton } from "./rodar-auditoria-button";

// Mesmo tamanho de página das demais abas desta tela (ver
// COLABORADORES_TAB_PAGE_SIZE em colaboradores-tab.tsx, EPIS_TAB_PAGE_SIZE
// em epis-tab.tsx e PENDENCIAS_TAB_PAGE_SIZE em pendencias-tab.tsx) —
// pedido do Rafael, 05/10/2026: empresas com muitos setores cadastrados
// deixavam essa lista enorme também.
const CHECKLIST_TAB_PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

// Ícones pequenos e neutros (text-text-muted) dentro das células — mesmo
// padrão de colaboradores/empresas/pagamentos. IconSetor é o mesmo desenho
// de "camadas" já usado pra setor em colaboradores/page.tsx (lá como
// IconLayers) — mantém a mesma leitura visual de "setor" em toda a tela.
function IconSetor(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 12l9 5 9-5" />
      <path d="M3 16l9 5 9-5" />
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

// Pessoa só (sem a segunda silhueta de IconUsers) — marca "isso é o nome de
// alguém", não "lista de pessoas".
function IconResponsavel(props: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20c0-3.6 2.9-6.3 6.5-6.3s6.5 2.7 6.5 6.3" />
    </svg>
  );
}

/**
 * "Checklist de campo" — a metade OBSERVACIONAL da Auditoria NR-06: as 8
 * perguntas oficiais do PGR, respondidas por alguém que foi olhar o setor de
 * verdade (uso ininterrupto, ajuste, higienização...). Isso não dá pra tirar
 * de nenhum dado já registrado no sistema — é o complemento da aba "Visão
 * geral"/"Pendências", que audita só os REGISTROS já existentes (ver
 * comentário no topo de lib/data/auditoria-registros.ts). Era a tela inteira
 * de /auditoria antes de virar uma aba, 06/10/2026.
 *
 * Paginação (20 por página): mesmo padrão das demais abas desta tela —
 * pedido do Rafael, 05/10/2026 ("podemos ter empresas com vários setores").
 */
export async function ChecklistCampoTab({
  user,
  empresaId,
  pagina,
}: {
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  empresaId: string | null;
  pagina: number;
}) {
  const [setores, nr06Counts, caVencendoTotal] = await Promise.all([
    listSetoresComStatusAuditoria(empresaId),
    getNr06StatusCounts(empresaId),
    countCaVencendo(empresaId),
  ]);

  const podeGerenciar = temPapelMinimo(user?.papel, "encarregado");

  const total = setores.length;
  const totalPaginas = Math.max(1, Math.ceil(total / CHECKLIST_TAB_PAGE_SIZE));
  const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (paginaAtual - 1) * CHECKLIST_TAB_PAGE_SIZE;
  const setoresPagina = setores.slice(inicio, inicio + CHECKLIST_TAB_PAGE_SIZE);

  return (
    <div>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-[12.5px] font-semibold text-text-secondary">
            Treinamento/Integração NR-06 pendente
          </p>
          <p className="mt-1.5 text-2xl font-bold text-foreground">
            {nr06Counts.pendente}
          </p>
          <Link
            href="/colaboradores?nr06=pendente"
            className="mt-1.5 inline-block text-[12.5px] font-semibold text-brand-700 hover:underline"
          >
            Ver colaboradores →
          </Link>
        </Card>
        <Card>
          <p className="text-[12.5px] font-semibold text-text-secondary">
            C.A. vencendo em até 30 dias
          </p>
          <p className="mt-1.5 text-2xl font-bold text-foreground">
            {caVencendoTotal}
          </p>
          <Link
            href="/epis"
            className="mt-1.5 inline-block text-[12.5px] font-semibold text-brand-700 hover:underline"
          >
            Ver EPIs →
          </Link>
        </Card>
      </div>

      {total === 0 ? (
        <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
          Nenhum setor cadastrado ainda.
        </p>
      ) : (
        <>
          {/* Tabela — só a partir de `xl` (mesmo limite de colaboradores/
              usuarios/estoque/empresas/pagamentos). Abaixo disso vira a
              lista de cartões logo adiante (bloco `xl:hidden`). */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card xl:block">
            <table className="w-full border-collapse bg-surface text-left">
              <thead>
                <tr>
                  {["Setor", "Última auditoria", "Responsável", "Situação", "Ação"].map(
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
                {setoresPagina.map((s) => {
                  const pendencias = s.ultimaAuditoria
                    ? contarNaoConformidades(s.ultimaAuditoria.respostas)
                    : 0;
                  return (
                    <ClickableRow
                      key={s.id}
                      href={`/auditoria/${s.id}`}
                      label={`Ver histórico de auditoria de ${s.nome}`}
                    >
                      <td className="max-w-[220px] px-2.5 py-[9px] text-[12.5px] font-medium text-foreground">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <IconSetor className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                          <span className="min-w-0 truncate" title={s.nome}>
                            {s.nome}
                          </span>
                        </span>
                      </td>
                      <td className="px-2.5 py-[9px] text-[12.5px] text-text-secondary">
                        {s.ultimaAuditoria ? (
                          <span className="inline-flex items-center gap-1.5">
                            <IconCalendarSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                            {formatDate(s.ultimaAuditoria.data)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[180px] px-2.5 py-[9px] text-[12.5px] text-text-secondary">
                        {s.ultimaAuditoria ? (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <IconResponsavel className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                            <span
                              className="min-w-0 truncate"
                              title={s.ultimaAuditoria.responsavel}
                            >
                              {s.ultimaAuditoria.responsavel}
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2.5 py-[9px]">
                        {!s.ultimaAuditoria ? (
                          <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-text-muted">
                            Nunca auditado
                          </span>
                        ) : pendencias > 0 ? (
                          <span className="rounded-full bg-danger-bg px-2.5 py-1 text-[11px] font-semibold text-danger-text">
                            {pendencias} pendência{pendencias === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                            Conforme
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-[9px]">
                        {podeGerenciar && (
                          <RodarAuditoriaButton
                            setorId={s.id}
                            setorNome={s.nome}
                            responsavelPadrao={user?.nome ?? ""}
                          />
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
            {setoresPagina.map((s) => {
              const pendencias = s.ultimaAuditoria
                ? contarNaoConformidades(s.ultimaAuditoria.respostas)
                : 0;
              return (
                <ClickableCard
                  key={s.id}
                  href={`/auditoria/${s.id}`}
                  label={`Ver histórico de auditoria de ${s.nome}`}
                  className="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <IconSetor className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">
                        {s.nome}
                      </span>
                    </span>
                    {!s.ultimaAuditoria ? (
                      <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-text-muted">
                        Nunca auditado
                      </span>
                    ) : pendencias > 0 ? (
                      <span className="shrink-0 rounded-full bg-danger-bg px-2.5 py-1 text-[11px] font-semibold text-danger-text">
                        {pendencias} pendência{pendencias === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                        Conforme
                      </span>
                    )}
                  </div>

                  {s.ultimaAuditoria && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <IconCalendarSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                        {formatDate(s.ultimaAuditoria.data)}
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <IconResponsavel className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                        <span className="min-w-0 truncate">
                          {s.ultimaAuditoria.responsavel}
                        </span>
                      </span>
                    </div>
                  )}

                  {podeGerenciar && (
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
                      <RodarAuditoriaButton
                        setorId={s.id}
                        setorNome={s.nome}
                        responsavelPadrao={user?.nome ?? ""}
                      />
                    </div>
                  )}
                </ClickableCard>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <span className="text-[12.5px] text-text-secondary">
              Página {paginaAtual} de {totalPaginas} · {total} setor
              {total === 1 ? "" : "es"}
            </span>
            <div className="flex gap-2">
              <Link
                href={`/auditoria?aba=checklist&pagina=${paginaAtual - 1}`}
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
                href={`/auditoria?aba=checklist&pagina=${paginaAtual + 1}`}
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
        </>
      )}
      {!podeGerenciar && (
        <p className="mt-2.5 text-[12px] text-text-muted">
          Seu perfil de acesso não permite registrar auditorias.
        </p>
      )}
    </div>
  );
}
