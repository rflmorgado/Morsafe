"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

export type AtualizarLogoState = {
  error: string | null;
  // DEBUG TEMPORÁRIO — remover junto com o debug de ficha/route.ts assim que
  // descobrirmos por que o logo salvo não volta na leitura (ver
  // getEmpresaAtual / ficha/route.ts). Mostra quantas linhas o update
  // realmente afetou no banco.
  debug?: string;
};

/**
 * Salva (ou remove, passando null) o logo da empresa exibido no topo da
 * Ficha de EPI. A tabela `empresas` não tem RLS no banco (só a criação em
 * /setup-empresa é restrita, ver comentário lá) — então a trava de verdade
 * aqui é dupla: papel mínimo "admin" checado no servidor, e o id da empresa
 * sempre vem do usuário autenticado (getCurrentUser), nunca de um campo do
 * formulário que alguém poderia adulterar pra editar o logo de outra
 * empresa cliente.
 */
export async function atualizarLogoEmpresa(
  logoDataUrl: string | null,
): Promise<AtualizarLogoState> {
  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: "Seu perfil de acesso não permite essa ação." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .update({ logo_url: logoDataUrl })
    .eq("id", user.empresaId)
    .select("id, logo_url");

  const debug = `update empresaId=${user.empresaId} linhasAfetadas=${
    data?.length ?? 0
  } logoUrlSalvo=${
    data?.[0]?.logo_url ? `presente(${data[0].logo_url.length} chars)` : "null"
  } erro=${error?.message ?? "nenhum"}`;

  if (error) {
    console.error("atualizarLogoEmpresa:", error.message);
    return { error: "Não foi possível salvar o logo. Tente novamente.", debug };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "empresas",
    registroId: user.empresaId,
    acao: "atualizado",
    usuarioId: user.id,
    detalhes: {
      nome: user.empresaNome,
      acao_logo: logoDataUrl === null ? "removido" : "atualizado",
    },
  });

  revalidatePath("/empresa");
  return { error: null, debug };
}
