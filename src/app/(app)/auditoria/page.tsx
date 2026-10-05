import Link from "next/link";
import { getCurrentUser } from "@/lib/data/current-user";
import { PageHeader } from "@/components/ui/page-header";
import { VisaoGeralTab } from "./visao-geral-tab";
import { PendenciasTab } from "./pendencias-tab";
import { ChecklistCampoTab } from "./checklist-campo-tab";
import { ColaboradoresTab } from "./colaboradores-tab";
import { EpisTab } from "./epis-tab";

// Ícone vibrante do cabeçalho — mesmo desenho do item de menu Auditoria
// NR-06 (ver IconAuditoria em nav-icons.tsx): prancheta com check.
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

const ABAS = [
  { chave: "geral", label: "Visão geral", emBreve: false },
  { chave: "pendencias", label: "Pendências", emBreve: false },
  { chave: "checklist", label: "Checklist de campo", emBreve: false },
  { chave: "colaboradores", label: "Colaboradores", emBreve: false },
  { chave: "epis", label: "EPIs", emBreve: false },
  { chave: "relatorio", label: "Relatório", emBreve: true },
] as const;

type Aba = (typeof ABAS)[number]["chave"];

function isAba(value: string | undefined): value is Aba {
  return !!value && ABAS.some((a) => a.chave === value);
}

/**
 * Barra de abas — navegação simples por URL (`?aba=`), sem JS no cliente:
 * cada aba é uma page.tsx renderizada no servidor de novo, igual qualquer
 * outro link do app. Aba "em breve" (Relatório, geração de PDF — ver pedido
 * do Rafael, 06/10/2026) fica como pill desabilitada, mesmo tratamento
 * visual do item "em breve" da barra lateral (app-shell.tsx), adaptado pro
 * fundo claro do conteúdo.
 */
function TabsNav({ atual }: { atual: Aba }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1.5 border-b border-border-subtle pb-3">
      {ABAS.map((a) =>
        a.emBreve ? (
          <span
            key={a.chave}
            title={`${a.label} — em breve`}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-text-muted/60"
          >
            {a.label}
            <span className="rounded-full border border-border-subtle px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide text-text-muted uppercase">
              Em breve
            </span>
          </span>
        ) : (
          <Link
            key={a.chave}
            href={a.chave === "geral" ? "/auditoria" : `/auditoria?aba=${a.chave}`}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
              atual === a.chave
                ? "bg-brand-700 text-white"
                : "text-text-secondary hover:bg-surface-muted"
            }`}
          >
            {a.label}
          </Link>
        ),
      )}
    </div>
  );
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const { aba: abaParam } = await searchParams;
  const aba: Aba = isAba(abaParam) ? abaParam : "geral";

  const user = await getCurrentUser();
  const empresaId = user?.empresaId ?? null;

  return (
    <div>
      <PageHeader
        title="Auditoria NR-06"
        description="Diagnóstico dos registros de EPI (o que o sistema tem documentado) e checklist de campo (o que foi observado no setor) — as duas metades de uma evidência completa."
        icon={<IconAuditoriaHeader className="h-5 w-5" />}
      />

      <TabsNav atual={aba} />

      {aba === "geral" && <VisaoGeralTab empresaId={empresaId} />}
      {aba === "pendencias" && <PendenciasTab empresaId={empresaId} />}
      {aba === "checklist" && <ChecklistCampoTab user={user} empresaId={empresaId} />}
      {aba === "colaboradores" && <ColaboradoresTab empresaId={empresaId} />}
      {aba === "epis" && <EpisTab empresaId={empresaId} />}
    </div>
  );
}
