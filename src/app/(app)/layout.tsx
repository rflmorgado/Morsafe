import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/data/current-user";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <AppShell
      userNome={user?.nome ?? ""}
      empresaNome={user?.empresaNome ?? null}
      isSuperAdmin={user?.papel === "super_admin"}
      isAdmin={user?.papel === "admin"}
    >
      {children}
    </AppShell>
  );
}
