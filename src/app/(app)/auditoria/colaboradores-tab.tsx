import Link from "next/link";
import {
  apurarAuditoriaRegistros,
  type ColaboradorAuditoria,
} from "@/lib/data/auditoria-registros";
import { ClickableRow } from "@/components/ui/clickable-row";
import { ClickableCard } from "@/components/ui/clickable-card";

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

// Mesmo desenho de "camadas" usado em checklist-campo-tab.tsx (IconSetor) —
// mantém a mesma leitura visual de "setor" em toda a tela de Auditoria.
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

const STATUS_BADGE: Record<
  ColaboradorAuditoria["status"],
  { label: string; className: string }
> = {
  completo: {
    label: "Completo",
    className: "bg-brand-100 text-brand-700",
  },
  pendente: {
    label: "Pendente",
    className: "bg-danger-bg text-danger-text",
  },
  sem_exigencia: {
    label: "Sem exigência cadastrada",
    className: "bg-surface-muted text-text-muted",
  },
};

/**
 * "Colaboradores" — mesma apuração das abas Visão geral/Pendências (ver
 * apurarAuditoriaRegistros), agora organizada por PESSOA: pra cada
 * colaborador ativo, mostra se ele está com todos os EPIs obrigatórios do
 * setor em dia (posse atual = entrega sem devolução depois). "Sem exigência
 * cadastrada" não é uma falha do colaborador — é o setor dele que ainda não
 * tem nenhum EPI marcado como obrigatório em setor_epi (ver cadastro de
 * setores). Pedido do Rafael, 06/10/2026 ("auditoria por colaborador").
 *
 * Sem link de detalhe próprio: cada linha leva pra ficha que já existe em
 * /colaboradores/[id] (histórico completo de entregas/devoluções), em vez
 * de duplicar essa visão aqui.
 */
export async function ColaboradoresTab({
  empresaId,
}: {
  empresaId: string | null;
}) {
  const apuracao = await apurarAuditoriaRegistros(empresaId);

  if (apuracao.colaboradoresDetalhe.length === 0) {
    return (
      <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
        Nenhum colaborador ativo cadastrado ainda.
      </p>
    );
  }

  return (
    <div>
      {/* Tabela — só a partir de `xl`, mesmo limite usado no resto do app. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card xl:block">
        <table className="w-full border-collapse bg-surface text-left">
          <thead>
            <tr>
              {["Colaborador", "Setor", "Situação", "Última entrega"].map(
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
            {apuracao.colaboradoresDetalhe.map((c) => {
              const badge = STATUS_BADGE[c.status];
              return (
                <ClickableRow
                  key={c.id}
                  href={`/colaboradores/${c.id}`}
                  label={`Ver ficha de ${c.nome}`}
                >
                  <td className="max-w-[220px] px-2.5 py-[9px] text-[12.5px] font-medium text-foreground">
                    <span className="min-w-0 truncate" title={c.nome}>
                      {c.nome}
                    </span>
                  </td>
                  <td className="max-w-[180px] px-2.5 py-[9px] text-[12.5px] text-text-secondary">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <IconSetor className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      <span className="min-w-0 truncate" title={c.setorNome}>
                        {c.setorNome}
                      </span>
                    </span>
                  </td>
                  <td className="px-2.5 py-[9px]">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
                    >
                      {c.status === "pendente"
                        ? `${c.episFaltando.length} EPI${c.episFaltando.length === 1 ? "" : "s"} pendente${c.episFaltando.length === 1 ? "" : "s"}`
                        : badge.label}
                    </span>
                    {c.status === "pendente" && (
                      <p
                        className="mt-1 max-w-[260px] truncate text-[11px] text-text-muted"
                        title={c.episFaltando.join(", ")}
                      >
                        {c.episFaltando.join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="px-2.5 py-[9px] text-[12.5px] text-text-secondary">
                    {c.ultimaEntrega ? (
                      <span className="inline-flex items-center gap-1.5">
                        <IconCalendarSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                        {formatDate(c.ultimaEntrega)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </ClickableRow>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Lista de cartões — abaixo de `xl`. */}
      <div className="space-y-2 xl:hidden">
        {apuracao.colaboradoresDetalhe.map((c) => {
          const badge = STATUS_BADGE[c.status];
          return (
            <ClickableCard
              key={c.id}
              href={`/colaboradores/${c.id}`}
              label={`Ver ficha de ${c.nome}`}
              className="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">
                  {c.nome}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
                >
                  {c.status === "pendente"
                    ? `${c.episFaltando.length} pendente${c.episFaltando.length === 1 ? "" : "s"}`
                    : badge.label}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-secondary">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <IconSetor className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  <span className="min-w-0 truncate">{c.setorNome}</span>
                </span>
                {c.ultimaEntrega && (
                  <span className="inline-flex items-center gap-1">
                    <IconCalendarSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    {formatDate(c.ultimaEntrega)}
                  </span>
                )}
              </div>
              {c.status === "pendente" && (
                <p className="mt-1.5 text-[11.5px] text-text-muted">
                  Falta: {c.episFaltando.join(", ")}
                </p>
              )}
            </ClickableCard>
          );
        })}
      </div>

      <p className="mt-3 text-[12px] text-text-muted">
        <Link
          href="/colaboradores"
          className="font-semibold text-brand-700 hover:underline"
        >
          Ver todos os colaboradores →
        </Link>
      </p>
    </div>
  );
}
