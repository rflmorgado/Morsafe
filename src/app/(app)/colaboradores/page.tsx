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

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function buildHref(q: string | undefined, setor: string | undefined, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (setor) params.set("setor", setor);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/colaboradores${qs ? `?${qs}` : ""}`;
}

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; setor?: string; page?: string }>;
}) {
  const { q, setor, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ colaboradores, total }, setores, user] = await Promise.all([
    listColaboradores({ query: q, setorId: setor, page }),
    listSetoresComCargos(),
    getCurrentUser(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / COLABORADORES_PAGE_SIZE));

  return (
    <div className="space-y-1">
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Colaboradores
      </h2>
      <p className="mb-5 text-[13px] text-text-secondary">
        Lista com busca rápida e filtro por setor.
      </p>

      <div className="mb-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <ColaboradoresFilters setores={setores} />
        <div className="flex gap-2">
          <ImportarColaboradoresButton setores={setores} />
          <NovoColaboradorButton setores={setores} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border-subtle">
        <table className="w-full min-w-[720px] border-collapse bg-surface text-left">
          <thead>
            <tr>
              {["Nome", "Setor", "Cargo", "Status", "Última entrega", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="border-b border-border-subtle bg-brand-50 px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wide text-text-secondary"
                  >
                    {h}
                  </th>
                ),
              )}
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
                      <BaixarFichaButton
                        colaboradorId={c.id}
                        colaboradorNome={c.nome}
                      />
                      {c.status === "ativo" ? (
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
                      )}
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
              href={buildHref(q, setor, page - 1)}
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
              href={buildHref(q, setor, page + 1)}
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
