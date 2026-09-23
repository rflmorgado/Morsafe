"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

export async function logout() {
  const supabase = await createClient();

  // Precisa ser buscado ANTES do signOut — depois disso a sessão já não
  // existe mais e getCurrentUser() voltaria null.
  const user = await getCurrentUser();
  if (user?.empresaId) {
    await registrarLogAuditoria({
      supabase,
      empresaId: user.empresaId,
      tabela: "usuarios",
      registroId: user.id,
      acao: "logout",
      usuarioId: user.id,
    });
  }

  await supabase.auth.signOut();
  redirect("/login");
}
