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

  const { error } = await supabase
    .from("estacoes_assinatura")
    .update({
      token: null,
      codigo_pareamento: codigo,
      codigo_expira_em: expiraEm,
      pareado_em: null,
    })
    .eq("id", estacaoId);

  if (error) {
    console.error("gerarNovoCodigoPareamento:", error.message);
    return {
      error: "Não foi possível gerar um novo código. Tente novamente.",
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
  const { data: estacao } = await supabase
    .from("estacoes_assinatura")
    .select("nome")
    .eq("id", estacaoId)
    .maybeSingle();

  const { error } = await supabase
    .from("estacoes_assinatura")
    .update({ ativo: false })
    .eq("id", estacaoId);

  if (error) {
    console.error("desativarEstacaoAssinatura:", error.message);
    return {
      error: "Não foi possível desativar a estação. Tente novamente.",
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
  const { data: estacao } = await supabase
    .from("estacoes_assinatura")
    .select("nome")
    .eq("id", estacaoId)
    .maybeSingle();

  const { error } = await supabase
    .from("estacoes_assinatura")
    .update({ ativo: true })
    .eq("id", estacaoId);

  if (error) {
    console.error("reativarEstacaoAssinatura:", error.message);
    return {
      error: "Não foi possível reativar a estação. Tente novamente.",
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
