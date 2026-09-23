import Link from "next/link";
import { notFound } from "next/navigation";
import { getColaboradorDetalhe } from "@/lib/data/colaboradores";

const TIPO_LABEL: Record<string, string> = {
  entrega: "Entrega",
  devolucao: "Devolução",
  recusa: "Recusa",
};

const DOT_CLASS: Record<string, string> = {
  entrega: "bg-brand-600",
  devolucao: "bg-text-muted",
  recusa: "bg-warning-text",
};

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default async function ColaboradorDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const colaborador = await getColaboradorDetalhe(id);

  if (!colaborador) notFound();

  return (
    <div className="space-y-1">
      <Link
        href="/colaboradores"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:underline"
      >
        ← Colaboradores
      </Link>

      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Ficha do colaborador
      </h2>
      <p className="mb-5 text-[13px] text-text-secondary">
        Histórico completo de entregas, devoluções e recusas.
      </p>

      <div className="overflow-hidden rounded-[14px] border border-border-subtle bg-surface">
        <div
          className="flex items-center gap-3.5 px-6 py-5"
          style={{ background: "var(--brand-900)" }}
        >
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-brand-600 text-[17px] font-bold text-white">
            {initials(colaborador.nome)}
          </div>
          <div>
            <div className="text-[17px] font-bold text-white">
              {colaborador.nome}
            </div>
            <div className="text-[12.5px] text-brand-100/70">
              {colaborador.setor} · {colaborador.cargo}
            </div>
          </div>
          <span
            className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              colaborador.status === "ativo"
                ? "bg-brand-100 text-brand-700"
                : "bg-danger-bg text-danger-text"
            }`}
          >
            {colaborador.status === "ativo" ? "Ativo" : "Inativo"}
          </span>
        </div>

        <div className="px-6 py-5">
          {colaborador.eventos.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nenhuma entrega, devolução ou recusa registrada ainda.
            </p>
          ) : (
            colaborador.eventos.map((evento) => (
              <div
                key={evento.id}
                className="flex gap-3.5 border-b border-border-subtle py-3 last:border-b-0"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[evento.tipo]}`}
                />
                <div>
                  <div className="text-[13.5px] font-semibold text-foreground">
                    {TIPO_LABEL[evento.tipo]} — {evento.epi}
                  </div>
                  <div className="mt-0.5 text-xs text-text-secondary">
                    {formatDate(evento.data)} · {evento.detalhe}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
