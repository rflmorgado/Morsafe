"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/data/current-user";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

export type CriarPagamentoState = { error: string | null };

/**
 * Registra um novo pagamento (mensalidade) pendente pra uma empresa
 * cliente. Só super_admin. Usa o cliente com service role, mesmo padrão de
 * app/(app)/empresas/actions.ts — pagamentos_empresa não tem RLS (ver
 * morsafe-add-pagamentos-empresa.sql), só o super_admin acessa.
 */
export async function criarPagamento(
  empresaId: string,
  valor: number,
  dataVencimento: string,
  observacao: string,
): Promise<CriarPagamentoState> {
  const user = await getCurrentUser();
  if (!user || user.papel !== "super_admin") {
    return { error: SEM_PERMISSAO };
  }

  if (!empresaId) {
    return { error: "Selecione a empresa." };
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    return { error: "Informe um valor válido." };
  }
  if (!dataVencimento) {
    return { error: "Informe a data de vencimento." };
  }

  const admin = createAdminClient();

  const { data: empresa, error: empresaError } = await admin
    .from("empresas")
    .select("id, nome")
    .eq("id", empresaId)
    .maybeSingle();

  if (empresaError || !empresa) {
    console.error("criarPagamento (busca empresa):", empresaError?.message);
    return { error: "Empresa não encontrada." };
  }

  const { data, error } = await admin
    .from("pagamentos_empresa")
    .insert({
      empresa_id: empresaId,
      valor,
      data_vencimento: dataVencimento,
      observacao: observacao.trim() || null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("criarPagamento:", error?.message);
    return { error: "Não foi possível registrar o pagamento." };
  }

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: empresa.id,
    tabela: "pagamentos_empresa",
    registroId: data.id,
    acao: "pagamento_criado",
    usuarioId: user.id,
    detalhes: { nome: empresa.nome, valor, data_vencimento: dataVencimento },
  });

  revalidatePath("/pagamentos");
  revalidatePath(`/empresas/${empresaId}`);
  revalidatePath("/dashboard");
  return { error: null };
}

export type MarcarPagoState = { error: string | null };

/**
 * Marca um pagamento pendente como recebido hoje. Não existe o caminho
 * inverso (desmarcar) de propósito — se foi engano, o jeito é criar um
 * registro novo corrigido; mantém o histórico simples de ler.
 */
export async function marcarPagamentoComoPago(
  pagamentoId: string,
): Promise<MarcarPagoState> {
  const user = await getCurrentUser();
  if (!user || user.papel !== "super_admin") {
    return { error: SEM_PERMISSAO };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("pagamentos_empresa")
    .update({
      status: "pago",
      data_pagamento: new Date().toISOString().slice(0, 10),
    })
    .eq("id", pagamentoId)
    .eq("status", "pendente")
    .select("id, empresa_id, valor, empresas ( nome )")
    .maybeSingle();

  if (error) {
    console.error("marcarPagamentoComoPago:", error.message);
    return { error: "Não foi possível atualizar o pagamento." };
  }
  if (!data) {
    return { error: "Pagamento não encontrado (ou já estava marcado como pago)." };
  }

  const empresaNome =
    (data.empresas as unknown as { nome: string } | null)?.nome ?? null;

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: data.empresa_id,
    tabela: "pagamentos_empresa",
    registroId: data.id,
    acao: "pagamento_recebido",
    usuarioId: user.id,
    detalhes: { nome: empresaNome, valor: data.valor },
  });

  revalidatePath("/pagamentos");
  revalidatePath(`/empresas/${data.empresa_id}`);
  revalidatePath("/dashboard");
  return { error: null };
}
