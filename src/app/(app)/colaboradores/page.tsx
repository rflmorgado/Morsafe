import Link from "next/link";
import { ClickableRow } from "@/components/ui/clickable-row";
import {
  listColaboradores,
  COLABORADORES_PAGE_SIZE,
} from "@/lib/data/colaboradores";
import { listSetoresComCargos } from "@/lib/data/setores";
import { getCurrentUser } from "@/lib/data/current-user";
import { NovoColaboradorButton } from "./novo-colaborador-button";
import { ImportarColaboradoresButton } from "./importar-colaboradores-button";
import { DesligarColaboradorButton } from "./desligar-colaborador-button";
import { ReativarColaboradorButton } from "./reativar-colaborador-button";
import { BaixarFichaButton } from "./baixar-ficha-button";
import { EditarColaboradorButton } from "./editar-colaborador-button";
import { ColaboradoresFilters } from "./colaboradores-filters";
import { temPapelMinimo } from "@/lib/auth/permissoes";

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

type SortKey = "nome" | "setor" | "cargo" | "status" | "ultima_entrega";

const COLUNAS: { label: string; sortKey: SortKey | null }[] = [
  { label: "Nome", sortKey: "nome" },
  { label: "Setor", sortKey: "setor" },
  { label: "Cargo", sortKey: "cargo" },
  { label: "Status", sortKey: "status" },
  { label: "Última entrega", sortKey: "ultima_entrega" },
  { label: "", sortKey: null },
];

function buildHref(
  q: string | undefined,
  setor: string | undefined,
  status: string | undefined,
  sort: string | undefined,
  dir: string | undefined,
  page: number,
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (setor) params.set("setor", setor);
  if (status) params.set("status", status);
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
  sort: string | undefined,
  dir: string | undefined,
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (setor) params.set("setor", setor);
  if (status) params.set("status", status);
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
  sortAtual: string,
  dirAtual: string,
  coluna: SortKey,
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (setor) params.set("setor", setor);
  if (status) params.set("status", status);
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
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const { q, setor, status, sort, dir, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const sortAtual = sort ?? "nome";
  const dirAtual = dir ?? "asc";

  const [{ colaboradores, total }, setores, user] = await Promise.all([
    listColaboradores({ query: q, setorId: setor, status, sort, dir, page }),
    listSetoresComCargos(),
    getCurrentUser(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / COLABORADORES_PAGE_SIZE));

  // Controle de acesso por papel: "leitura" só visualiza (busca, filtra,
  // ordena, vê detalhe e baixa ficha); "encarregado" também cadastra, edita,
  // importa e exporta; só "admin"+ desliga/reativa. As Server Actions e
  // rotas fazem a mesma checagem de novo — esconder o botão aqui é só pra
  // não oferecer uma ação que vai ser barrada, nunca a única barreira.
  const podeGerenciar = temPapelMinimo(user?.papel, "encarregado");
  const podeDesligarOuReativar = temPapelMinimo(user?.papel, "admin");

  return (
    <div className="space-y-1">
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Colaboradores
      </h2>
      <p className="mb-5 text-[13px] text-text-secondary">
        Lista com busca rápida e filtro por setor.
      </p>

      <div className="mb-4 flex flex-col gap-3">
        <ColaboradoresFilters setores={setores} />
        {podeGerenciar && (
          <div className="flex flex-wrap justify-end gap-2">
            <a
              href={buildExportHref(q, setor, status, sort, dir)}
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
            <ImportarColaboradoresButton setores={setores} />
            <NovoColaboradorButton setores={setores} />
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border-subtle">
        <table className="w-full min-w-[720px] border-collapse bg-surface text-left">
          <thead>
            <tr>
              {COLUNAS.map((coluna) => (
                <th
                  key={coluna.label || "acoes"}
                  className="border-b border-border-subtle bg-brand-50 px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wide text-text-secondary"
                >
                  {coluna.sortKey ? (
                    <Link
                      href={buildSortHref(
                        q,
                        setor,
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
            {colaboradores.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-sm text-text-muted"
                >
                  Nenhum colaborador encontrado.
                </td>
              </tr>
            ) : (
              colaboradores.map((c) => (
                <ClickableRow key={c.id} href={`/colaboradores/${c.id}`}>
                  <td className="px-4 py-3.5 text-[13.5px] font-medium text-foreground">
                    {c.nome}
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                    {c.setor}
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                    {c.cargo}
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
                    {c.ultimaEntrega ? formatDate(c.ultimaEntrega) : "—"}
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
                          }}
                          setores={setores}
                        />
                      )}
                      <BaixarFichaButton
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
                          <ReativarColaboradorButton
                            colaboradorId={c.id}
                            colaboradorNome={c.nome}
                          />
                        ))}
                    </div>
                  </td>
                </ClickableRow>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="text-[12.5px] text-text-secondary">
            Página {page} de {totalPages} · {total} colaborador
            {total === 1 ? "" : "es"}
          </span>
          <div className="flex gap-2">
            <Link
              href={buildHref(q, setor, status, sort, dir, page - 1)}
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
              href={buildHref(q, setor, status, sort, dir, page + 1)}
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
