import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/data/current-user";
import { getEmpresaLogoUrl } from "@/lib/data/empresa";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // super_admin não tem empresa (empresaId nulo) — nem busca o logo. Pra
  // quem tem empresa, roda em toda página protegida (a barra lateral é
  // sempre visível), por isso o lookup dedicado e enxuto em
  // getEmpresaLogoUrl (ver comentário lá) em vez de getEmpresaAtual.
  const empresaLogoUrl = user?.empresaId
    ? await getEmpresaLogoUrl(user.empresaId)
    : null;

  return (
    <AppShell
      userNome={user?.nome ?? ""}
      empresaNome={user?.empresaNome ?? null}
      empresaLogoUrl={empresaLogoUrl}
      isSuperAdmin={user?.papel === "super_admin"}
      isAdmin={user?.papel === "admin"}
    >
      {children}
    </AppShell>
  );
}
