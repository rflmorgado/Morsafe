import { ClickableRow } from "@/components/ui/clickable-row";
import { listColaboradores } from "@/lib/data/colaboradores";
import { listSetoresComCargos } from "@/lib/data/setores";
import { getCurrentUser } from "@/lib/data/current-user";
import { NovoColaboradorButton } from "./novo-colaborador-button";
import { DesligarColaboradorButton } from "./desligar-colaborador-button";

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [colaboradores, setores, user] = await Promise.all([
    listColaboradores(q),
    listSetoresComCargos(),
    getCurrentUser(),
  ]);

  return (
    <div className="space-y-1">
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Colaboradores
      </h2>
      <p className="mb-5 text-[13px] text-text-secondary">
        Lista com busca rápida e filtro por setor.
      </p>

      <div className="mb-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <form method="get" className="max-w-[320px] flex-1">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar colaborador…"
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </form>
        <NovoColaboradorButton setores={setores} />
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
                    {c.status === "ativo" && (
                      <DesligarColaboradorButton
                        colaboradorId={c.id}
                        colaboradorNome={c.nome}
                        userEmail={user?.email ?? ""}
                      />
                    )}
                  </td>
                </ClickableRow>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
