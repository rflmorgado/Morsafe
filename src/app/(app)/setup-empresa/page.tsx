import { getCurrentUser } from "@/lib/data/current-user";
import { SetupEmpresaForm } from "./setup-empresa-form";

// Só o(s) usuário(s) super_admin (dono do MorSafe) veem este item de menu
// (ver NAV_ITEMS em nav-items.ts), mas a página também checa o papel aqui
// como segunda camada — acesso direto pela URL não basta.
export default async function SetupEmpresaPage() {
  const user = await getCurrentUser();

  if (!user || user.papel !== "super_admin") {
    return (
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Acesso restrito
        </h2>
        <p className="text-[13px] text-text-secondary">
          Esta página é exclusiva do administrador do MorSafe.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Cadastrar nova empresa
      </h2>
      <p className="mb-5 text-[13px] text-text-secondary">
        Cria o acesso de uma nova empresa cliente e seu primeiro usuário
        admin.
      </p>

      <SetupEmpresaForm />
    </div>
  );
}
