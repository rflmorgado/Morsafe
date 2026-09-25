import type { Metadata } from "next";
import { ShieldIcon } from "@/components/brand/shield-icon";
import { getVerificacaoPorCodigo } from "@/lib/data/verificacao-documento";

export const metadata: Metadata = {
  title: "Verificação de documento | MorSafe",
  description: "Confirme a autenticidade de um documento emitido pelo MorSafe.",
};

const TIPO_DOCUMENTO_LABEL: Record<string, string> = {
  ficha_epi: "Ficha de Entrega de EPI",
};

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-2.5 text-center">
          <ShieldIcon className="h-10 w-10" />
          <div className="text-[19px] font-bold tracking-tight text-foreground">
            <span className="text-brand-700">Mor</span>
            <span className="font-extrabold text-brand-600">Safe</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function VerificarDocumentoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const verificacao = await getVerificacaoPorCodigo(codigo.trim().toLowerCase());

  if (!verificacao) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border-subtle bg-surface p-7 shadow-[0_1px_2px_rgba(18,53,36,0.06),0_4px_16px_rgba(18,53,36,0.06)]">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger-text">
              ✕
            </div>
            <h1 className="text-[17px] font-bold text-foreground">
              Código não encontrado
            </h1>
          </div>
          <p className="text-[13.5px] leading-relaxed text-text-secondary">
            Não existe nenhum documento com este código de verificação. Isso
            pode acontecer se o código foi digitado ou copiado incorretamente
            — confira se o link ou o código no rodapé do documento está
            completo, sem espaços ou caracteres a mais.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rounded-2xl border border-border-subtle bg-surface p-7 shadow-[0_1px_2px_rgba(18,53,36,0.06),0_4px_16px_rgba(18,53,36,0.06)]">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            ✓
          </div>
          <div>
            <h1 className="text-[17px] font-bold text-foreground">
              Documento autêntico
            </h1>
            <p className="text-[12.5px] text-text-secondary">
              Emitido pelo sistema MorSafe
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3.5 border-t border-border-subtle pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Tipo de documento
            </dt>
            <dd className="mt-0.5 text-[13.5px] font-semibold text-foreground">
              {TIPO_DOCUMENTO_LABEL[verificacao.tipoDocumento] ?? verificacao.tipoDocumento}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Gerado em
            </dt>
            <dd className="mt-0.5 text-[13.5px] font-semibold text-foreground">
              {formatarDataHora(verificacao.geradoEm)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Empresa
            </dt>
            <dd className="mt-0.5 text-[13.5px] font-semibold text-foreground">
              {verificacao.empresaNome}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Colaborador
            </dt>
            <dd className="mt-0.5 text-[13.5px] font-semibold text-foreground">
              {verificacao.colaboradorNome}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Eventos incluídos
            </dt>
            <dd className="mt-0.5 text-[13.5px] font-semibold text-foreground">
              {verificacao.quantidadeEventos}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Código
            </dt>
            <dd className="mt-0.5 font-mono text-[13px] font-semibold text-foreground">
              {verificacao.codigo}
            </dd>
          </div>
        </dl>

        <div className="mt-5 border-t border-border-subtle pt-4">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Hash de conteúdo (SHA-256)
          </dt>
          <dd className="mt-1 break-all rounded-lg bg-surface-muted px-3 py-2 font-mono text-[11px] text-text-secondary">
            {verificacao.hash}
          </dd>
        </div>

        <p className="mt-5 text-[12px] leading-relaxed text-text-muted">
          Esta página confirma que um documento com este código foi
          efetivamente gerado pelo MorSafe, na data acima, para o colaborador
          e a empresa indicados. Se o conteúdo do PDF apresentado divergir das
          informações aqui exibidas, ou se o código impresso no documento não
          corresponder ao hash acima, o documento pode ter sido alterado após
          a emissão.
        </p>
      </div>
    </Shell>
  );
}
