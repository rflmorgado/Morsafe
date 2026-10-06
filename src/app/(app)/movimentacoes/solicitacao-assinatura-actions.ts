"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import type {
  StatusSolicitacaoAssinatura,
  TipoSolicitacaoAssinatura,
} from "@/types/database";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

export type CriarSolicitacaoState =
  | { error: string; id?: undefined }
  | { error: null; id: string };

/**
 * Chamado pelo PC ao escolher "coletar assinatura na estação X" no
 * formulário de Registrar entrega OU de Registrar devolução — cria o pedido
 * que a estação (ver src/app/estacao) vai encontrar na próxima vez que
 * consultar o servidor. `tipo` só decide o texto mostrado lá (ver
 * src/app/estacao/page.tsx); o resto do fluxo é idêntico. Usa o cliente
 * comum (RLS por empresa), diferente das actions de src/app/estacao/actions.ts,
 * que rodam sem usuário logado.
 */
export async function criarSolicitacaoAssinatura({
  estacaoId,
  colaboradorNome,
  epiNome,
  tipo,
}: {
  estacaoId: string;
  colaboradorNome: string;
  epiNome: string;
  tipo: TipoSolicitacaoAssinatura;
}): Promise<CriarSolicitacaoState> {
  const user = await getCurrentUser();
  if (!user || !user.empresaId) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  // Confirma que a estação de destino pertence à MESMA empresa de quem está
  // pedindo, antes de inserir — sem isso, alguém que soubesse o id de uma
  // estação de OUTRA empresa cliente conseguiria fazer o pedido aparecer no
  // tablet dela (ver CLAUDE.md e a auditoria de isolamento entre empresas).
  const { data: estacao, error: estacaoError } = await supabase
    .from("estacoes_assinatura")
    .select("empresa_id, ativo")
    .eq("id", estacaoId)
    .maybeSingle();

  if (estacaoError || !estacao || estacao.empresa_id !== user.empresaId) {
    return { error: "Estação não encontrada." };
  }
  if (!estacao.ativo) {
    return { error: "Esta estação está desativada." };
  }

  const { data, error } = await supabase
    .from("solicitacoes_assinatura")
    .insert({
      empresa_id: user.empresaId,
      estacao_id: estacaoId,
      colaborador_nome: colaboradorNome,
      epi_nome: epiNome,
      tipo,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("criarSolicitacaoAssinatura:", error?.message);
    return {
      error: "Não foi possível enviar o pedido pra estação. Tente novamente.",
    };
  }

  return { error: null, id: data.id };
}

export type StatusSolicitacaoResult = {
  error: string | null;
  status?: StatusSolicitacaoAssinatura;
  assinaturaUrl?: string | null;
};

/**
 * Consultado pelo PC a cada ~2s enquanto mostra "Aguardando assinatura na
 * estação..." — assim que o status vira "assinado", o formulário usa a
 * assinaturaUrl devolvida aqui pra completar o registro normalmente.
 */
export async function buscarStatusSolicitacao(
  id: string,
): Promise<StatusSolicitacaoResult> {
  const user = await getCurrentUser();
  if (!user || !user.empresaId) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitacoes_assinatura")
    .select("status, assinatura_url")
    .eq("id", id)
    // Reconfirma a empresa do pedido, não só o id — sem isso, qualquer
    // usuário logado (de qualquer empresa) que descobrisse/adivinhasse o
    // UUID de um pedido de OUTRA empresa conseguiria ler a assinatura dela
    // (ver auditoria de isolamento entre empresas, 06/10/2026). Esta tabela
    // ainda não tem RLS própria, então esta checagem é a única barreira.
    .eq("empresa_id", user.empresaId)
    .maybeSingle();

  if (error || !data) {
    return { error: "Pedido de assinatura não encontrado." };
  }

  return {
    error: null,
    status: data.status,
    assinaturaUrl: data.assinatura_url,
  };
}

export type CancelarSolicitacaoState = { error: string | null };

/**
 * Chamado quando o encarregado desiste de esperar (fecha o formulário ou
 * clica em "cancelar") — só apaga o pedido se ele ainda estiver
 * "aguardando"; se a estação já tiver mandado a assinatura entre o clique
 * de cancelar e esta chamada, o pedido fica como está (assinado).
 */
export async function cancelarSolicitacaoAssinatura(
  id: string,
): Promise<CancelarSolicitacaoState> {
  const user = await getCurrentUser();
  if (!user || !user.empresaId) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("solicitacoes_assinatura")
    .update({ status: "cancelado" })
    .eq("id", id)
    // Mesma barreira de empresa_id de buscarStatusSolicitacao acima — sem
    // isso, um usuário de outra empresa poderia cancelar o pedido de
    // assinatura de alguém que nem conhece.
    .eq("empresa_id", user.empresaId)
    .eq("status", "aguardando");

  if (error) {
    console.error("cancelarSolicitacaoAssinatura:", error.message);
    return { error: "Não foi possível cancelar o pedido." };
  }

  return { error: null };
}
