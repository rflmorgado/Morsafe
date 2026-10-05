import { getCurrentUser } from "@/lib/data/current-user";
import { getEmpresaAtual } from "@/lib/data/empresa";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LogoEmpresaForm } from "./logo-empresa-form";

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

  const empresa = await getEmpresaAtual(user.empresaId);

  return (
    <div className="space-y-1">
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
    </div>
  );
}
