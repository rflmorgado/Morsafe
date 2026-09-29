"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";
import {
  gerarCodigoPareamento,
  calcularExpiracaoCodigo,
} from "@/lib/estacao-assinatura/tokens";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

export type PareamentoInfo = {
  codigo: string;
  expiraEm: string;
};

export type EstacaoActionState = {
  error: string | null;
  pareamento?: PareamentoInfo;
};

/**
 * Cria uma nova estação de assinatura (ainda sem aparelho pareado) e já
 * gera o primeiro código de pareamento — a tela mostra esse código como QR
 * pro admin escanear com o tablet/celular da própria empresa.
 */
export async function criarEstacaoAssinatura(
  nome: string,
): Promise<EstacaoActionState> {
  const user = await getCurrentUser();
  if (!user || !user.empresaId) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) {
    return { error: "Digite um nome pra identificar a estação." };
  }

  const supabase = await createClient();
  const codigo = gerarCodigoPareamento();
  const expiraEm = calcularExpiracaoCodigo();

  const { data, error } = await supabase
    .from("estacoes_assinatura")
    .insert({
      empresa_id: user.empresaId,
      nome: nomeLimpo,
      codigo_pareamento: codigo,
      codigo_expira_em: expiraEm,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("criarEstacaoAssinatura:", error?.message);
    return { error: "Não foi possível criar a estação. Tente novamente." };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "estacoes_assinatura",
    registroId: data.id,
    acao: "criado",
    usuarioId: user.id,
    detalhes: { nome: nomeLimpo },
  });

  revalidatePath("/estacoes");
  return { error: null, pareamento: { codigo, expiraEm } };
}

/**
 * Gera um novo código de pareamento pra uma estação existente — serve tanto
 * pra parear um aparelho de novo (o código anterior expirou sem terminar)
 * quanto pra TROCAR o aparelho de uma estação (tablet quebrou/foi trocado).
 * Nos dois casos zera o token atual: se já havia um aparelho pareado, ele
 * perde o acesso imediatamente até que o código novo seja usado — isso é o
 * que permite ao admin revogar um aparelho perdido na hora.
 */
export async function gerarNovoCodigoPareamento(
  estacaoId: string,
): Promise<EstacaoActionState> {
  const user = await getCurrentUser();
  if (!user || !user.empresaId) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const codigo = gerarCodigoPareamento();
  const expiraEm = calcularExpiracaoCodigo();

  const { data: estacao, error: buscaError } = await supabase
    .from("estacoes_assinatura")
    .select("empresa_id")
    .eq("id", estacaoId)
    .maybeSingle();

  if (buscaError || !estacao || estacao.empresa_id !== user.empresaId) {
    return { error: "Estação não encontrada." };
  }

  const { data, error } = await supabase
    .from("estacoes_assinatura")
    .update({
      token: null,
      codigo_pareamento: codigo,
      codigo_expira_em: expiraEm,
      pareado_em: null,
    })
    .eq("id", estacaoId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("gerarNovoCodigoPareamento:", error.message);
    return {
      error: "Não foi possível gerar um novo código. Tente novamente.",
    };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: um .update() que não bate com
  // nenhuma linha retorna error: null mesmo sem gravar nada — sem este check
  // a tela mostraria um QR válido pro admin escanear sem o código
  // correspondente ter sido salvo no banco, e o pareamento falharia sempre.
  if (!data) {
    console.error(
      "gerarNovoCodigoPareamento: update não afetou nenhuma linha para estacaoId=",
      estacaoId,
    );
    return {
      error:
        "Não foi possível confirmar a geração do código. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  revalidatePath("/estacoes");
  return { error: null, pareamento: { codigo, expiraEm } };
}

export type SimpleActionState = { error: string | null; success?: boolean };

export async function desativarEstacaoAssinatura(
  estacaoId: string,
): Promise<SimpleActionState> {
  const user = await getCurrentUser();
  if (!user || !user.empresaId) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const { data: estacao, error: buscaError } = await supabase
    .from("estacoes_assinatura")
    .select("nome, empresa_id")
    .eq("id", estacaoId)
    .maybeSingle();

  // Mesma checagem que gerarNovoCodigoPareamento já faz — sem ela, um admin
  // de uma empresa poderia desativar/reativar a estação de outra empresa
  // cliente só sabendo (ou adivinhando) o id dela.
  if (buscaError || !estacao || estacao.empresa_id !== user.empresaId) {
    return { error: "Estação não encontrada." };
  }

  const { data, error } = await supabase
    .from("estacoes_assinatura")
    .update({ ativo: false })
    .eq("id", estacaoId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("desativarEstacaoAssinatura:", error.message);
    return {
      error: "Não foi possível desativar a estação. Tente novamente.",
    };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: sem ela, um .update() que não
  // bate com nenhuma linha registraria "desativado" no histórico e diria
  // sucesso pro admin mesmo com a estação continuando ativa (e continuando a
  // aceitar pedidos de assinatura).
  if (!data) {
    console.error(
      "desativarEstacaoAssinatura: update não afetou nenhuma linha para estacaoId=",
      estacaoId,
    );
    return {
      error:
        "Não foi possível confirmar a desativação. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "estacoes_assinatura",
    registroId: estacaoId,
    acao: "desativado",
    usuarioId: user.id,
    detalhes: estacao ? { nome: estacao.nome } : null,
  });

  revalidatePath("/estacoes");
  return { error: null, success: true };
}

export async function reativarEstacaoAssinatura(
  estacaoId: string,
): Promise<SimpleActionState> {
  const user = await getCurrentUser();
  if (!user || !user.empresaId) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const { data: estacao, error: buscaError } = await supabase
    .from("estacoes_assinatura")
    .select("nome, empresa_id")
    .eq("id", estacaoId)
    .maybeSingle();

  if (buscaError || !estacao || estacao.empresa_id !== user.empresaId) {
    return { error: "Estação não encontrada." };
  }

  const { data, error } = await supabase
    .from("estacoes_assinatura")
    .update({ ativo: true })
    .eq("id", estacaoId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("reativarEstacaoAssinatura:", error.message);
    return {
      error: "Não foi possível reativar a estação. Tente novamente.",
    };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: sem ela, um .update() que não
  // bate com nenhuma linha registraria "reativado" no histórico e diria
  // sucesso pro admin mesmo com a estação continuando desativada.
  if (!data) {
    console.error(
      "reativarEstacaoAssinatura: update não afetou nenhuma linha para estacaoId=",
      estacaoId,
    );
    return {
      error:
        "Não foi possível confirmar a reativação. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "estacoes_assinatura",
    registroId: estacaoId,
    acao: "reativado",
    usuarioId: user.id,
    detalhes: estacao ? { nome: estacao.nome } : null,
  });

  revalidatePath("/estacoes");
  return { error: null, success: true };
}

export type ExcluirEstacaoState = { error: string | null; success?: boolean };

/**
 * Exclusão definitiva — só liberada (ver EstacaoRowActions) para uma
 * estação já desativada, mesmo padrão de EPI/colaborador/usuário:
 * "desativar" é o caminho do dia a dia (reversível, sem confirmação por
 * digitação), "excluir" é definitivo e não tem volta.
 *
 * Diferente de EPI/usuário, aqui não existe nenhuma tabela de conformidade
 * (entregas/devoluções/recusas) apontando pra estação — só
 * `solicitacoes_assinatura`, que é o estado transitório de cada pedido
 * (pendente/assinado/cancelado), nunca o registro legal em si: a
 * assinatura, uma vez confirmada, já foi copiada pro campo
 * `assinatura_url` da ENTREGA correspondente (ver registrarEntrega em
 * movimentacoes/actions.ts), que não referencia a estação e é imutável por
 * design. Por isso apaga essas solicitações de propósito antes — sem isso,
 * a FK solicitacoes_assinatura_estacao_id_fkey bloquearia a exclusão.
 *
 * Confirma que a linha saiu de verdade (via .select() no delete) em vez de
 * confiar só em error === null (CLAUDE.md item 1) — sem isso, um RLS sem
 * policy de delete faria essa chamada "funcionar" sem apagar nada, e o
 * admin acharia que excluiu quando na verdade a estação continuaria lá.
 */
export async function excluirEstacaoAssinatura(
  estacaoId: string,
): Promise<ExcluirEstacaoState> {
  const user = await getCurrentUser();
  if (!user || !user.empresaId) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const { data: estacao, error: buscaError } = await supabase
    .from("estacoes_assinatura")
    .select("nome, ativo, empresa_id")
    .eq("id", estacaoId)
    .maybeSingle();

  if (buscaError || !estacao || estacao.empresa_id !== user.empresaId) {
    return { error: "Estação não encontrada." };
  }
  if (estacao.ativo) {
    return {
      error:
        "Só é possível excluir definitivamente uma estação que já está desativada.",
    };
  }

  const { error: solicitacoesError } = await supabase
    .from("solicitacoes_assinatura")
    .delete()
    .eq("estacao_id", estacaoId);

  if (solicitacoesError) {
    console.error(
      "excluirEstacaoAssinatura (solicitações):",
      solicitacoesError.message,
    );
    return {
      error: "Não foi possível excluir o histórico de pedidos desta estação.",
    };
  }

  const { data: apagadas, error: deleteError } = await supabase
    .from("estacoes_assinatura")
    .delete()
    .eq("id", estacaoId)
    .select("id");

  if (deleteError || !apagadas || apagadas.length === 0) {
    console.error(
      "excluirEstacaoAssinatura:",
      deleteError?.message ?? "nenhuma linha afetada",
    );
    return { error: "Não foi possível excluir a estação. Tente novamente." };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "estacoes_assinatura",
    registroId: estacaoId,
    acao: "excluido",
    usuarioId: user.id,
    detalhes: { nome: estacao.nome },
  });

  revalidatePath("/estacoes");
  return { error: null, success: true };
}
