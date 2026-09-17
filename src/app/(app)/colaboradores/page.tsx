import { ClickableRow } from "@/components/ui/clickable-row";
import { listColaboradores } from "@/lib/data/colaboradores";

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const colaboradores = await listColaboradores(q);

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
        <button
          type="button"
          disabled
          title="Em breve"
          className="rounded-lg bg-brand-700/40 px-4 py-2.5 text-[13.5px] font-semibold text-white/70"
        >
          + Novo colaborador
        </button>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border-subtle">
        <table className="w-full min-w-[640px] border-collapse bg-surface text-left">
          <thead>
            <tr>
              {["Nome", "Setor", "Cargo", "Status", "Última entrega"].map(
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
                  colSpan={5}
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
                </ClickableRow>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
