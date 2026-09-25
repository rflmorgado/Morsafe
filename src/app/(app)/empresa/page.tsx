import { getCurrentUser } from "@/lib/data/current-user";
import { getEmpresaAtual } from "@/lib/data/empresa";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LogoEmpresaForm } from "./logo-empresa-form";

// Só admin (ou super_admin) vê este item de menu (ver NAV_ITEMS /
// app-shell.tsx), mas a página também checa o papel aqui como segunda
// camada — acesso direto pela URL não basta.
export default async function EmpresaPage() {
  const user = await getCurrentUser();

  if (!user?.empresaId || !temPapelMinimo(user.papel, "admin")) {
    return (
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Acesso restrito
        </h2>
        <p className="text-[13px] text-text-secondary">
          Esta página é exclusiva de administradores.
        </p>
      </div>
    );
  }

  const empresa = await getEmpresaAtual(user.empresaId);

  return (
    <div className="space-y-1">
      <PageHeader
        title="Dados da empresa"
        description="Informações usadas na Ficha de EPI e nos demais documentos gerados pelo sistema."
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
