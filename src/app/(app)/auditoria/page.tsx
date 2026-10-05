import Link from "next/link";
import {
  listSetoresComStatusAuditoria,
  countCaVencendo,
} from "@/lib/data/auditorias-nr06";
import { contarNaoConformidades } from "@/lib/data/auditorias-nr06-perguntas";
import { getNr06StatusCounts } from "@/lib/data/colaboradores";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ClickableRow } from "@/components/ui/clickable-row";
import { ClickableCard } from "@/components/ui/clickable-card";
import { RodarAuditoriaButton } from "./rodar-auditoria-button";

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

// Ícone vibrante do cabeçalho (mesmo tratamento de Dashboard/Colaboradores/
// EPIs/Usuários/Estoque/Empresas/Pagamentos) — o mesmo desenho do item de
// menu Auditoria NR-06 (ver IconAuditoria em nav-icons.tsx): prancheta com
// check, de "checklist concluído".
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
// alguém", não "lista de pessoas" (esse já é o significado de IconUsers no
// cabeçalho de Colaboradores).
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

export default async function AuditoriaPage() {
  const user = await getCurrentUser();
  const empresaId = user?.empresaId ?? null;

  // As 3 consultas são independentes entre si — o resumo de conformidade
  // (treinamento/C.A.) não depende da lista de setores nem vice-versa.
  const [setores, nr06Counts, caVencendoTotal] = await Promise.all([
    listSetoresComStatusAuditoria(empresaId),
    getNr06StatusCounts(empresaId),
    countCaVencendo(empresaId),
  ]);

  // Mesmo nível de permissão de registrar entrega/devolução/entrada de
  // estoque — rodar o checklist é rotina operacional, não administração.
  const podeGerenciar = temPapelMinimo(user?.papel, "encarregado");

  return (
    <div>
      <PageHeader
        title="Auditoria NR-06"
        description="Checklist periódico de conformidade por setor, com as 8 perguntas oficiais do PGR — além do resumo abaixo, que reaproveita o que o resto do sistema já controla (C.A. e treinamento)."
        icon={<IconAuditoriaHeader className="h-5 w-5" />}
      />

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

      {setores.length === 0 ? (
        <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
          Nenhum setor cadastrado ainda.
        </p>
      ) : (
        <>
          {/* Tabela — só a partir de `xl` (mesmo limite de colaboradores/
              usuarios/estoque/empresas/pagamentos: menu lateral + margens do
              card deixam pouco mais de 820px líquidos pra tabela nesse
              ponto). Abaixo disso vira a lista de cartões logo adiante
              (bloco `xl:hidden`). 5 colunas, como pagamentos/page.tsx — bem
              abaixo do limite de largura. */}
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
                {setores.map((s) => {
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
            {setores.map((s) => {
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
