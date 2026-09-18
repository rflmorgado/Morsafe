import Link from "next/link";
import { listEpis, EPIS_PAGE_SIZE } from "@/lib/data/epis";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { EpisFilters } from "./epis-filters";
import { NovoEpiButton } from "./novo-epi-button";
import { EditarEpiButton } from "./editar-epi-button";
import { DesativarEpiButton } from "./desativar-epi-button";
import { ReativarEpiButton } from "./reativar-epi-button";

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Abaixo desse limite de dias até o vencimento, o C.A. já aparece com aviso
// (âmbar) em vez de esperar vencer de fato (vermelho) — dá tempo de agir.
const LIMIAR_VENCIMENTO_DIAS = 60;

function statusCa(caValidade: string | null) {
  if (!caValidade) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(caValidade + "T00:00:00");
  const diffDias = Math.round(
    (validade.getTime() - hoje.getTime()) / 86_400_000,
  );

  if (diffDias < 0) {
    return {
      label: `Vencido em ${formatDate(caValidade)}`,
      className: "text-danger-text",
    };
  }
  if (diffDias <= LIMIAR_VENCIMENTO_DIAS) {
    return {
      label: `Vence em ${formatDate(caValidade)}`,
      className: "text-warning-text",
    };
  }
  return {
    label: `Válido até ${formatDate(caValidade)}`,
    className: "text-text-muted",
  };
}

function buildHref(
  q: string | undefined,
  tipo: string | undefined,
  status: string | undefined,
  page: number,
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tipo) params.set("tipo", tipo);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/epis${qs ? `?${qs}` : ""}`;
}

export default async function EpisPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    tipo?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const { q, tipo, status, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ epis, total }, user] = await Promise.all([
    listEpis({ query: q, tipo, status, page }),
    getCurrentUser(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / EPIS_PAGE_SIZE));

  // Mesma regra de colaboradores: "encarregado"+ cadastra/edita/desativa;
  // aqui não existe um nível extra tipo "admin" para a ação mais sensível,
  // porque desativar um EPI do catálogo não tem peso trabalhista — ver
  // comentário em actions.ts. As Server Actions fazem a mesma checagem de
  // novo; esconder o botão aqui nunca é a única barreira.
  const podeGerenciar = temPapelMinimo(user?.papel, "encarregado");

  return (
    <div className="space-y-1">
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        EPIs homologados
      </h2>
      <p className="mb-5 text-[13px] text-text-secondary">
        Cadastro mestre de EPI, com C.A. e custo médio.
      </p>

      <div className="mb-4 flex flex-col gap-3">
        <EpisFilters />
        {podeGerenciar && (
          <div className="flex flex-wrap justify-end gap-2">
            <NovoEpiButton />
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border-subtle">
        <table className="w-full min-w-[680px] border-collapse bg-surface text-left">
          <thead>
            <tr>
              {["EPI", "Tipo", "C.A.", "Custo médio", "Status", ""].map(
                (label) => (
                  <th
                    key={label || "acoes"}
                    className="border-b border-border-subtle bg-brand-50 px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wide text-text-secondary"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {epis.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-text-muted">
                  Nenhum EPI encontrado.
                </td>
              </tr>
            ) : (
              epis.map((e) => {
                const ca = statusCa(e.caValidade);
                return (
                  <tr
                    key={e.id}
                    className="border-b border-border-subtle last:border-b-0"
                  >
                    <td className="px-4 py-3.5 text-[13.5px] font-medium text-foreground">
                      {e.nome}
                    </td>
                    <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                      {e.tipo ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                      {e.exigeCa ? (
                        <div>
                          <div>{e.ca ?? "—"}</div>
                          {ca && (
                            <div className={`text-[11px] ${ca.className}`}>
                              {ca.label}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted">Não exige C.A.</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                      {formatMoney(e.custoMedioAtual)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          e.ativo
                            ? "bg-brand-100 text-brand-700"
                            : "bg-danger-bg text-danger-text"
                        }`}
                      >
                        {e.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {podeGerenciar && <EditarEpiButton epi={e} />}
                        {podeGerenciar &&
                          (e.ativo ? (
                            <DesativarEpiButton
                              epiId={e.id}
                              epiNome={e.nome}
                            />
                          ) : (
                            <ReativarEpiButton epiId={e.id} epiNome={e.nome} />
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="text-[12.5px] text-text-secondary">
            Página {page} de {totalPages} · {total} EPI
            {total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Link
              href={buildHref(q, tipo, status, page - 1)}
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
              href={buildHref(q, tipo, status, page + 1)}
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
