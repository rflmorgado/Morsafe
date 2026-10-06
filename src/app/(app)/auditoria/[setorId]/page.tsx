import Link from "next/link";
import { notFound } from "next/navigation";
import { getSetorComHistoricoAuditoria } from "@/lib/data/auditorias-nr06";
import {
  contarNaoConformidades,
  PERGUNTAS_AUDITORIA_NR06,
} from "@/lib/data/auditorias-nr06-perguntas";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { PageHeader } from "@/components/ui/page-header";
import { RodarAuditoriaButton } from "../rodar-auditoria-button";

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

// Mesmo desenho do cabeçalho de /auditoria (ver IconAuditoriaHeader em
// ../page.tsx) e do item de menu Auditoria NR-06 (IconAuditoria, em
// nav-icons.tsx) — identidade visual consistente entre a listagem e o
// histórico de um setor só.
function IconAuditoriaHeader(props: React.SVGProps<SVGSVGElement>) {
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
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 12.5l2 2 4-4" />
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

// Mesma pessoa-só de /auditoria (IconResponsavel, em ../page.tsx).
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

export default async function HistoricoAuditoriaSetorPage({
  params,
}: {
  params: Promise<{ setorId: string }>;
}) {
  const { setorId } = await params;

  const user = await getCurrentUser();
  const resultado = await getSetorComHistoricoAuditoria(
    user?.empresaId ?? null,
    setorId,
  );

  // Cobre tanto "setor inexistente" quanto "setor de outra empresa" — a
  // mesma checagem de posse que getSetorComHistoricoAuditoria já faz
  // internamente (ver lib/data/auditorias-nr06.ts).
  if (!resultado) notFound();

  const { setor, auditorias } = resultado;
  const podeGerenciar = temPapelMinimo(user?.papel, "encarregado");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/auditoria"
          className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:underline"
        >
          ← Auditoria NR-06
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            title={`Histórico de auditoria — ${setor.nome}`}
            description="Todas as rodadas do checklist de NR-06 já registradas para este setor, mais recente primeiro."
            icon={<IconAuditoriaHeader className="h-5 w-5" />}
          />
          {podeGerenciar && (
            <RodarAuditoriaButton
              setorId={setor.id}
              setorNome={setor.nome}
              responsavelPadrao={user?.nome ?? ""}
              variant="solid"
            />
          )}
        </div>
      </div>

      {auditorias.length === 0 ? (
        <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
          Nenhuma auditoria registrada ainda para este setor.
        </p>
      ) : (
        <div className="space-y-4">
          {auditorias.map((a) => {
            const pendencias = contarNaoConformidades(a.respostas);
            return (
              <div
                key={a.id}
                className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-card"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-foreground">
                      <IconCalendarSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      {formatDate(a.data)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary">
                      <IconResponsavel className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      {a.responsavel}
                    </span>
                  </div>
                  {pendencias > 0 ? (
                    <span className="rounded-full bg-danger-bg px-2.5 py-1 text-[11px] font-semibold text-danger-text">
                      {pendencias} pendência{pendencias === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                      Conforme
                    </span>
                  )}
                </div>

                <ul className="space-y-1.5">
                  {PERGUNTAS_AUDITORIA_NR06.map((p) => {
                    const resposta = a.respostas[p.chave];
                    return (
                      <li
                        key={p.chave}
                        className="flex items-start justify-between gap-3 text-[12.5px]"
                      >
                        <span className="text-text-secondary">
                          {p.pergunta}
                        </span>
                        <span
                          className={`shrink-0 font-semibold ${
                            resposta === true
                              ? "text-brand-700"
                              : resposta === false
                                ? "text-danger-text"
                                : "text-text-muted"
                          }`}
                        >
                          {resposta === true
                            ? "Sim"
                            : resposta === false
                              ? "Não"
                              : "N/A"}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {a.observacoes && (
                  <p className="mt-3 rounded-lg bg-surface-muted px-3.5 py-2.5 text-[12.5px] text-text-secondary">
                    {a.observacoes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
