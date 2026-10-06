import { apurarAuditoriaRegistros } from "@/lib/data/auditoria-registros";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";

function IconIndice(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </svg>
  );
}

function IconAlerta(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M12 9v4" />
      <path d="M10.3 3.9 1.9 18a1.8 1.8 0 0 0 1.5 2.7h17.2a1.8 1.8 0 0 0 1.5-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
      <path d="M12 16.2h.01" />
    </svg>
  );
}

function IconDownload(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function IconFilePdf(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

/**
 * "Relatório" — o PDF do diagnóstico da Auditoria NR-06, prometido desde que
 * esta tela virou abas (ver comentário em auditoria/page.tsx, "em breve").
 * A aba em si só mostra um resumo rápido + o botão de baixar; o conteúdo
 * completo (Raio-X, Pendências, Checklist de campo por setor) é montado no
 * PDF em si (ver auditoria/relatorio/route.ts), não duplicado aqui.
 */
export async function RelatorioTab({ empresaId }: { empresaId: string | null }) {
  const apuracao = await apurarAuditoriaRegistros(empresaId);

  if (apuracao.registrosAnalisados === 0) {
    return (
      <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
        Ainda não há dados suficientes para gerar um relatório — cadastre
        colaboradores, EPIs e registre entregas primeiro.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <IconFilePdf className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[14px] font-bold text-foreground">
              Relatório de Auditoria NR-06
            </p>
            <p className="mt-1 text-[12.5px] text-text-secondary">
              Reúne o resumo, o Raio-X dos controles, as pendências e a
              situação do checklist de campo por setor num único PDF — pronto
              para anexar a uma fiscalização ou guardar como evidência.
            </p>
          </div>
        </div>
        <a
          href="/auditoria/relatorio"
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90"
        >
          <IconDownload className="h-4 w-4" />
          Baixar relatório em PDF
        </a>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Índice de controle dos registros"
          value={`${apuracao.indiceControle}%`}
          icon={<IconIndice className="h-5 w-5" />}
          delta={`${apuracao.registrosAnalisados} registros analisados`}
          deltaTone={
            apuracao.criticoTotal > 0
              ? "danger"
              : apuracao.atencaoTotal > 0
                ? "warn"
                : "up"
          }
        />
        <KpiCard
          label="Sem pendência"
          value={apuracao.semPendencia}
          deltaTone="up"
        />
        <KpiCard
          label="Atenção"
          value={apuracao.atencaoTotal}
          icon={<IconAlerta className="h-5 w-5" />}
          deltaTone="warn"
        />
        <KpiCard
          label="Críticos"
          value={apuracao.criticoTotal}
          icon={<IconAlerta className="h-5 w-5" />}
          deltaTone="danger"
        />
      </div>

      <p className="rounded-2xl border border-border-subtle bg-surface-muted p-4 text-[12px] text-text-secondary">
        O PDF é gerado na hora, a partir dos dados mais recentes — abre numa
        nova aba do navegador, de onde também dá para salvar ou imprimir. Ele
        não substitui a observação em campo nem representa, por si só, uma
        declaração de conformidade com a NR-06.
      </p>
    </div>
  );
}
