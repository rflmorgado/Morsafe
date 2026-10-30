import { getCurrentUser } from "@/lib/data/current-user";
import { getEmpresaAtual } from "@/lib/data/empresa";
import { listUnidades } from "@/lib/data/unidades";
import {
  getAssinaturaDaEmpresa,
  formatStatusAssinatura,
  avisoAssinatura,
} from "@/lib/data/assinaturas";
import { PLANO_LABEL } from "@/lib/data/planos";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LogoEmpresaForm } from "./logo-empresa-form";
import { LogoUnidadeForm } from "./logo-unidade-form";
import { EmailCobrancaForm } from "./email-cobranca-form";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// `proximo_vencimento` é `date` puro — mesmo tratamento de formatDate em
// pagamentos/page.tsx e assinaturas/page.tsx.
function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

// Ícone vibrante do cabeçalho (mesmo tratamento de Dashboard/Colaboradores/
// EPIs/Movimentações/Estações) — um prédio simples (sede + um anexo menor),
// representando a empresa como um todo. Essa tela não tem lista de itens
// (é um registro único, os dados da própria empresa), então, diferente das
// outras, não tem ícone por linha — só o do cabeçalho mesmo.
function IconEmpresaHeader(props: React.SVGProps<SVGSVGElement>) {
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
      <rect x="4" y="3" width="10" height="18" rx="1" />
      <rect x="14" y="9" width="6" height="12" rx="1" />
      <path d="M7.5 7h3M7.5 11h3M7.5 15h3" />
      <path d="M17 13h.01M17 17h.01" />
    </svg>
  );
}

// Só admin (ou super_admin) vê este item de menu (ver NAV_ITEMS /
// app-shell.tsx), mas a página também checa o papel aqui como segunda
// camada — acesso direto pela URL não basta.
export default async function EmpresaPage() {
  const user = await getCurrentUser();

  if (!user?.empresaId || !temPapelMinimo(user.papel, "admin")) {
    return (
      <div className="space-y-1">
        <PageHeader
          title="Acesso restrito"
          description="Esta página é exclusiva de administradores."
        />
      </div>
    );
  }

  const [empresa, assinatura, unidades] = await Promise.all([
    getEmpresaAtual(user.empresaId),
    getAssinaturaDaEmpresa(user.empresaId),
    listUnidades(user.empresaId),
  ]);

  // A seção de "Unidades do grupo" só aparece pra quem tem mais de uma
  // unidade cadastrada (ex: ViniPlast + Vinitrade) — a maioria dos clientes
  // do MorSafe tem uma só e nunca precisa ver essa escolha extra. Ver
  // listUnidades (lib/data/unidades.ts) e LogoUnidadeForm.
  const temMultiplasUnidades = unidades.length > 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dados da empresa"
        description="Informações usadas na Ficha de EPI e nos demais documentos gerados pelo sistema."
        icon={<IconEmpresaHeader className="h-5 w-5" />}
      />

      <Card className="max-w-xl">
        <div className="mb-5 space-y-1 border-b border-border-subtle pb-4">
          <p className="text-[13.5px] font-semibold text-foreground">
            {empresa?.nome ?? user.empresaNome}
          </p>
          {empresa?.cnpj && (
            <p className="text-[12.5px] text-text-secondary">
              CNPJ: {empresa.cnpj}
            </p>
          )}
        </div>

        <LogoEmpresaForm logoAtual={empresa?.logoUrl ?? null} />
      </Card>

      {temMultiplasUnidades && (
        <Card className="max-w-xl">
          <div className="mb-5 space-y-1 border-b border-border-subtle pb-4">
            <p className="text-[13.5px] font-semibold text-foreground">
              Unidades do grupo
            </p>
            <p className="text-[12.5px] text-text-secondary">
              Sua empresa tem {unidades.length} unidades cadastradas (
              {unidades.map((u) => u.nome).join(", ")}). Defina um logo
              próprio para cada uma — a Ficha de EPI usa automaticamente o
              logo da unidade do colaborador, com o logo acima como reserva
              para quem ainda não tiver um definido.
            </p>
          </div>

          <div className="space-y-6 divide-y divide-border-subtle">
            {unidades.map((unidade) => (
              <div key={unidade.id} className="pt-6 first:border-0 first:pt-0">
                <LogoUnidadeForm
                  unidadeId={unidade.id}
                  nome={unidade.nome}
                  logoAtual={unidade.logoUrl}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="max-w-xl">
        <h3 className="mb-4 text-[13px] font-bold text-foreground">
          Cobrança
        </h3>
        <EmailCobrancaForm emailCobrancaAtual={empresa?.emailCobranca ?? null} />
      </Card>

      {/* Só aparece pra empresa com plano pago — empresas "interno" (ver
          setup-empresa/actions.ts) nunca têm linha em `assinaturas`, e
          getAssinaturaDaEmpresa devolve null nesse caso. */}
      {assinatura && (
        <Card className="max-w-xl">
          <h3 className="mb-4 text-[13px] font-bold text-foreground">
            Assinatura
          </h3>

          <dl className="grid grid-cols-2 gap-y-3 text-[13px] sm:grid-cols-4">
            <div>
              <dt className="text-[11px] font-semibold text-text-secondary uppercase">
                Plano
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {PLANO_LABEL[assinatura.plano]}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-text-secondary uppercase">
                Valor mensal
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {formatMoney(assinatura.valorMensal)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-text-secondary uppercase">
                Próximo vencimento
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {formatDate(assinatura.proximoVencimento)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-text-secondary uppercase">
                Status
              </dt>
              <dd className="mt-0.5">
                {(() => {
                  const status = formatStatusAssinatura(assinatura.status);
                  return (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${status.classe}`}
                    >
                      {status.texto}
                    </span>
                  );
                })()}
              </dd>
            </div>
          </dl>

          {avisoAssinatura(assinatura.status) && (
            <p
              // Mesmo tom do badge de status acima (ver formatStatusAssinatura)
              // — "pendente" é só um aviso leve (âmbar), "inadimplente"/
              // "suspensa" são sérios (vermelho), nunca os três com a
              // mesma cor de alerta.
              className={`mt-4 rounded-lg px-3.5 py-2.5 text-[12.5px] font-medium ${formatStatusAssinatura(assinatura.status).classe}`}
            >
              {avisoAssinatura(assinatura.status)}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
