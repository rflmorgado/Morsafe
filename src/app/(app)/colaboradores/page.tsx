import Link from "next/link";
import { ClickableRow } from "@/components/ui/clickable-row";
import { ClickableCard } from "@/components/ui/clickable-card";
import { Avatar } from "@/components/ui/avatar";
import {
  listColaboradores,
  COLABORADORES_PAGE_SIZE,
} from "@/lib/data/colaboradores";
import { listSetoresComCargos } from "@/lib/data/setores";
import { getCurrentUser } from "@/lib/data/current-user";
import { NovoColaboradorButton } from "./novo-colaborador-button";
import { ImportarColaboradoresButton } from "./importar-colaboradores-button";
import { GerenciarCargosButton } from "./gerenciar-cargos-button";
import { DesligarColaboradorButton } from "./desligar-colaborador-button";
import { ReativarColaboradorButton } from "./reativar-colaborador-button";
import { ExcluirColaboradorButton } from "./excluir-colaborador-button";
import { VisualizarFichaButton } from "./visualizar-ficha-button";
import { EditarColaboradorButton } from "./editar-colaborador-button";
import { ColaboradoresFilters } from "./colaboradores-filters";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { PageHeader } from "@/components/ui/page-header";
import { ListToolbar } from "@/components/ui/list-toolbar";

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

// Ícones pequenos e neutros (text-text-muted, sem bloco colorido) usados
// dentro das células da tabela — diferente do IconBadge vibrante do
// cabeçalho/Dashboard, de propósito: um bloco colorido sólido repetido em
// toda célula de toda linha (20 por página × 3 colunas) ficaria "confete",
// não premium. Aqui o ganho é só ícone + texto, discreto, igual Linear/
// Notion. IconUsers (cabeçalho da página) é o único vibrante desta tela,
// mesmo desenho de dashboard-super-admin.tsx, pra manter consistência.
function IconUsers(props: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2.5 20.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      <path d="M16 3.7a3.5 3.5 0 0 1 0 6.8" />
      <path d="M21.5 20.5c0-2.9-1.9-5.3-4.5-6.2" />
    </svg>
  );
}

function IconLayers(props: React.SVGProps<SVGSVGElement>) {
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

function IconIdBadge(props: React.SVGProps<SVGSVGElement>) {
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
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="10" r="2.2" />
      <path d="M8 16.5c.6-2 2-3 4-3s3.4 1 4 3" />
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

type SortKey = "nome" | "setor" | "cargo" | "status" | "ultima_entrega";

const COLUNAS: { label: string; sortKey: SortKey | null }[] = [
  { label: "Nome", sortKey: "nome" },
  { label: "Setor", sortKey: "setor" },
  { label: "Cargo", sortKey: "cargo" },
  { label: "Status", sortKey: "status" },
  { label: "Última entrega", sortKey: "ultima_entrega" },
  { label: "NR-06", sortKey: null },
  { label: "", sortKey: null },
];

function buildHref(
  q: string | undefined,
  setor: string | undefined,
  status: string | undefined,
  nr06: string | undefined,
  sort: string | undefined,
  dir: string | undefined,
  page: number,
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (setor) params.set("setor", setor);
  if (status) params.set("status", status);
  if (nr06) params.set("nr06", nr06);
  if (sort) params.set("sort", sort);
  if (dir) params.set("dir", dir);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/colaboradores${qs ? `?${qs}` : ""}`;
}

/**
 * Exportação respeita os mesmos filtros e a mesma ordenação aplicados na
 * tela (busca, setor, status, coluna), mas nunca a paginação — o CSV sempre
 * traz a lista inteira que bate com o filtro, não só os 20 colaboradores da
 * página visível.
 */
function buildExportHref(
  q: string | undefined,
  setor: string | undefined,
  status: string | undefined,
  nr06: string | undefined,
  sort: string | undefined,
  dir: string | undefined,
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (setor) params.set("setor", setor);
  if (status) params.set("status", status);
  if (nr06) params.set("nr06", nr06);
  if (sort) params.set("sort", sort);
  if (dir) params.set("dir", dir);
  const qs = params.toString();
  return `/colaboradores/export${qs ? `?${qs}` : ""}`;
}

/**
 * Clicar num cabeçalho de coluna ordena por ela; clicar de novo inverte a
 * direção. Trocar a ordenação sempre volta pra página 1 (não carrega o
 * parâmetro "page" adiante).
 */
function buildSortHref(
  q: string | undefined,
  setor: string | undefined,
  status: string | undefined,
  nr06: string | undefined,
  sortAtual: string,
  dirAtual: string,
  coluna: SortKey,
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (setor) params.set("setor", setor);
  if (status) params.set("status", status);
  if (nr06) params.set("nr06", nr06);
  const proximaDir = sortAtual === coluna && dirAtual !== "desc" ? "desc" : "asc";
  params.set("sort", coluna);
  params.set("dir", proximaDir);
  return `/colaboradores?${params.toString()}`;
}

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    setor?: string;
    status?: string;
    nr06?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const { q, setor, status, nr06, sort, dir, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const sortAtual = sort ?? "nome";
  const dirAtual = dir ?? "asc";

  // listColaboradores e listSetoresComCargos agora filtram por empresa (ver
  // colaboradores.ts/setores.ts) — precisam do usuário logado antes, então
  // buscamos ele primeiro e só então disparamos os dois em paralelo.
  const user = await getCurrentUser();
  const [setores, { colaboradores, total }] = await Promise.all([
    listSetoresComCargos(user?.empresaId ?? null),
    listColaboradores({
      empresaId: user?.empresaId ?? null,
      query: q,
      setorId: setor,
      status,
      nr06,
      sort,
      dir,
      page,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / COLABORADORES_PAGE_SIZE));

  // Controle de acesso por papel: "leitura" só visualiza (busca, filtra,
  // ordena, vê detalhe e a ficha); "encarregado" também cadastra, edita
  // e exporta; só "admin"+ desliga/reativa, importa planilha e exclui
  // definitivamente. Import e exclusão ficam no mesmo nível de
  // desligar/reativar porque são ações de maior risco/irreversíveis — uma
  // planilha errada bagunça vários cadastros de uma vez, e excluir não tem
  // volta (diferente de desligar, que tem reativar). O botão de excluir só
  // aparece pra quem já está desligado (ver coluna de ações da tabela). As
  // Server Actions e rotas fazem a mesma checagem de novo — esconder o
  // botão aqui é só pra não oferecer uma ação que vai ser barrada, nunca a
  // única barreira.
  const podeGerenciar = temPapelMinimo(user?.papel, "encarregado");
  const podeDesligarOuReativar = temPapelMinimo(user?.papel, "admin");
  const podeImportar = temPapelMinimo(user?.papel, "admin");

  // Mesmo padrão de listColaboradores/listColaboradoresParaExportar: sem
  // "status" na URL, o filtro aplicado de fato é "ativo" — esse aviso existe
  // pra deixar isso visível, já que por padrão os desligados somem da lista
  // (pedido do Rafael, 05/10/2026) em vez de simplesmente não aparecer sem
  // explicação nenhuma.
  const statusAtual =
    status === "ativo" || status === "inativo" || status === "todos"
      ? status
      : "ativo";

  return (
    <div className="space-y-1">
      <PageHeader
        title="Colaboradores"
        description="Lista com busca rápida e filtro por setor."
        icon={<IconUsers className="h-5 w-5" />}
      />

      {statusAtual !== "todos" && (
        <p className="px-0.5 text-[12.5px] text-text-secondary">
          Mostrando só colaboradores{" "}
          {statusAtual === "ativo" ? "ativos" : "inativos"} —{" "}
          <Link
            href={buildHref(q, setor, "todos", nr06, sort, dir, 1)}
            className="font-semibold text-brand-700 hover:underline"
          >
            ver todos
          </Link>
        </p>
      )}

      <ListToolbar
        filters={<ColaboradoresFilters setores={setores} />}
        actions={
          podeGerenciar && (
            <>
              <a
                href={buildExportHref(q, setor, status, nr06, sort, dir)}
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
              {podeImportar && (
                <ImportarColaboradoresButton setores={setores} />
              )}
              <GerenciarCargosButton setores={setores} />
              <NovoColaboradorButton setores={setores} />
            </>
          )
        }
      />

      {/* Tabela — só a partir de `lg` (mesmo ponto em que o menu lateral
          aparece). Abaixo disso, 6 colunas + ícones de ação não cabem sem
          rolar de lado por mais que o texto diminua — por isso vira lista
          de cartões (ver bloco `lg:hidden` logo abaixo), que mostra a mesma
          informação sem nenhuma rolagem horizontal. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card lg:block">
        <table className="w-full min-w-[840px] border-collapse bg-surface text-left">
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
                        setor,
                        status,
                        nr06,
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
            {colaboradores.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-sm text-text-muted"
                >
                  Nenhum colaborador encontrado.
                </td>
              </tr>
            ) : (
              colaboradores.map((c) => (
                // label descreve a linha pro leitor de tela (ver
                // ClickableRow) — todo o resto da linha (setor, cargo,
                // status, última entrega) é só apoio visual do mesmo link.
                <ClickableRow
                  key={c.id}
                  href={`/colaboradores/${c.id}`}
                  label={`Ver detalhes de ${c.nome}`}
                >
                  <td className="px-4 py-3.5 text-[13.5px] font-medium text-foreground">
                    <div className="flex items-center gap-2.5">
                      <Avatar nome={c.nome} size="sm" />
                      <span>{c.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <IconLayers className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      {c.setor}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <IconIdBadge className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      {c.cargo}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        c.status === "ativo"
                          ? "bg-brand-100 text-brand-700"
                          : "bg-danger-bg text-danger-text"
                      }`}
                    >
                      {c.status === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                    {c.ultimaEntrega ? (
                      <span className="inline-flex items-center gap-1.5">
                        <IconCalendarSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                        {formatDate(c.ultimaEntrega)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px]">
                    {c.dataIntegracaoSeguranca ? (
                      <span className="text-foreground">
                        {formatDate(c.dataIntegracaoSeguranca)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-[11px] font-semibold text-warning-text">
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {podeGerenciar && (
                        <EditarColaboradorButton
                          colaborador={{
                            id: c.id,
                            nome: c.nome,
                            setorId: c.setorId,
                            cargoId: c.cargoId,
                            cpf: c.cpf,
                            telefone: c.telefone,
                            dataIntegracaoSeguranca: c.dataIntegracaoSeguranca,
                          }}
                          setores={setores}
                        />
                      )}
                      <VisualizarFichaButton
                        colaboradorId={c.id}
                        colaboradorNome={c.nome}
                      />
                      {podeDesligarOuReativar &&
                        (c.status === "ativo" ? (
                          <DesligarColaboradorButton
                            colaboradorId={c.id}
                            colaboradorNome={c.nome}
                            userEmail={user?.email ?? ""}
                          />
                        ) : (
                          <>
                            <ReativarColaboradorButton
                              colaboradorId={c.id}
                              colaboradorNome={c.nome}
                            />
                            <ExcluirColaboradorButton
                              colaboradorId={c.id}
                              colaboradorNome={c.nome}
                              userEmail={user?.email ?? ""}
                            />
                          </>
                        ))}
                    </div>
                  </td>
                </ClickableRow>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Lista de cartões — telas abaixo de `lg` (ver comentário acima da
          tabela). Mesmas informações e mesmas ações (Editar, Ver ficha,
          Desligar/Reativar, Excluir), só que empilhadas em vez de em
          colunas, pra caber na largura da tela sem rolar de lado. */}
      <div className="space-y-2 lg:hidden">
        {colaboradores.length === 0 ? (
          <p className="rounded-2xl border border-border-subtle bg-surface px-4 py-6 text-center text-[13px] text-text-muted">
            Nenhum colaborador encontrado.
          </p>
        ) : (
          colaboradores.map((c) => (
            <ClickableCard
              key={c.id}
              href={`/colaboradores/${c.id}`}
              label={`Ver detalhes de ${c.nome}`}
              className="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar nome={c.nome} size="sm" />
                  <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">
                    {c.nome}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                    c.status === "ativo"
                      ? "bg-brand-100 text-brand-700"
                      : "bg-danger-bg text-danger-text"
                  }`}
                >
                  {c.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-secondary">
                <span className="inline-flex items-center gap-1">
                  <IconLayers className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  {c.setor}
                </span>
                <span className="inline-flex items-center gap-1">
                  <IconIdBadge className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  {c.cargo}
                </span>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <IconCalendarSmall className="h-3.5 w-3.5 shrink-0" />
                    {c.ultimaEntrega ? formatDate(c.ultimaEntrega) : "Sem entrega"}
                  </span>
                  {c.dataIntegracaoSeguranca ? (
                    <span>NR-06: {formatDate(c.dataIntegracaoSeguranca)}</span>
                  ) : (
                    <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[10.5px] font-semibold text-warning-text">
                      NR-06 pendente
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {podeGerenciar && (
                    <EditarColaboradorButton
                      colaborador={{
                        id: c.id,
                        nome: c.nome,
                        setorId: c.setorId,
                        cargoId: c.cargoId,
                        cpf: c.cpf,
                        telefone: c.telefone,
                        dataIntegracaoSeguranca: c.dataIntegracaoSeguranca,
                      }}
                      setores={setores}
                    />
                  )}
                  <VisualizarFichaButton
                    colaboradorId={c.id}
                    colaboradorNome={c.nome}
                  />
                  {podeDesligarOuReativar &&
                    (c.status === "ativo" ? (
                      <DesligarColaboradorButton
                        colaboradorId={c.id}
                        colaboradorNome={c.nome}
                        userEmail={user?.email ?? ""}
                      />
                    ) : (
                      <>
                        <ReativarColaboradorButton
                          colaboradorId={c.id}
                          colaboradorNome={c.nome}
                        />
                        <ExcluirColaboradorButton
                          colaboradorId={c.id}
                          colaboradorNome={c.nome}
                          userEmail={user?.email ?? ""}
                        />
                      </>
                    ))}
                </div>
              </div>
            </ClickableCard>
          ))
        )}
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="text-[12.5px] text-text-secondary">
            Página {page} de {totalPages} · {total} colaborador
            {total === 1 ? "" : "es"}
          </span>
          <div className="flex gap-2">
            <Link
              href={buildHref(q, setor, status, nr06, sort, dir, page - 1)}
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
              href={buildHref(q, setor, status, nr06, sort, dir, page + 1)}
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
