"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/data/current-user";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";
import { criarCobrancaAvulsaAsaas, AsaasError } from "@/lib/asaas/client";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

export type CriarPagamentoState = { error: string | null };

/**
 * Registra um novo pagamento pendente pra uma empresa cliente — usado hoje
 * sobretudo pra taxa de implantação (cobrada uma vez só, fora do ciclo da
 * assinatura recorrente — ver NovoPagamentoButton), mas serve pra qualquer
 * cobrança avulsa. Só super_admin. Usa o cliente com service role, mesmo
 * padrão de app/(app)/empresas/actions.ts — pagamentos_empresa não tem RLS
 * (ver morsafe-add-pagamentos-empresa.sql), só o super_admin acessa.
 *
 * Quando a empresa já tem cliente Asaas associado (plano comercial
 * implantado — ver criarEmpresa, setup-empresa/actions.ts), esta função
 * também cria a cobrança de verdade lá (ver criarCobrancaAvulsaAsaas), pra
 * o cliente receber um boleto/Pix real, em vez de só um lançamento local
 * que o super_admin teria que cobrar por fora. Empresa sem cliente Asaas
 * (plano "interno", ou migração de assinaturas ainda pendente — ver
 * morsafe-add-assinaturas-asaas.sql) continua só com o controle manual
 * local, como sempre foi.
 *
 * Ordem de segurança do dinheiro — mesmo princípio de criarEmpresa: a
 * linha local (pendente, sem asaas_payment_id ainda) é criada ANTES da
 * chamada ao Asaas, pra nunca gerar uma cobrança real sem um jeito de
 * rastreá-la aqui, mesmo que a gravação do id volte a falhar depois.
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

  // Cliente Asaas da empresa, se ela já tiver um (ver comentário acima da
  // função). Erro aqui (inclusive "tabela não existe", migração ainda
  // pendente) é tratado como "sem cliente Asaas" — igual o resto do
  // código já faz com colunas/tabelas pendentes — pra nunca bloquear o
  // controle manual local por causa de uma integração que essa empresa
  // nem usa.
  const { data: assinatura } = await admin
    .from("assinaturas")
    .select("asaas_customer_id")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const asaasCustomerId = assinatura?.asaas_customer_id ?? null;

  const observacaoFinal = observacao.trim() || null;

  const { data, error } = await admin
    .from("pagamentos_empresa")
    .insert({
      empresa_id: empresaId,
      valor,
      data_vencimento: dataVencimento,
      observacao: observacaoFinal,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("criarPagamento:", error?.message);
    return { error: "Não foi possível registrar o pagamento." };
  }

  if (asaasCustomerId) {
    try {
      const cobranca = await criarCobrancaAvulsaAsaas({
        asaasCustomerId,
        valor,
        vencimento: dataVencimento,
        descricao: observacaoFinal ?? `Cobrança MorSafe — ${empresa.nome}`,
        referenciaExterna: empresa.id,
      });

      const { error: atualizaError } = await admin
        .from("pagamentos_empresa")
        .update({ asaas_payment_id: cobranca.id })
        .eq("id", data.id);

      if (atualizaError) {
        // A cobrança JÁ FOI criada de verdade no Asaas a essa altura —
        // apagar o registro local agora deixaria uma cobrança real sem
        // nenhum rastro aqui, pior do que só não ter o id gravado. Fica
        // só o log bem visível pra conferência manual (painel do Asaas
        // tem o id, visível no log abaixo).
        console.error(
          `criarPagamento: cobrança criada no Asaas (${cobranca.id}) mas falhou ao gravar o id localmente (pagamento ${data.id}): ${atualizaError.message}`,
        );
      }
    } catch (e) {
      // Falha ao criar no Asaas (cliente inválido no Asaas, API fora do
      // ar etc.) — aqui sim desfaz o registro local, porque nada foi
      // cobrado de ninguém ainda.
      await admin.from("pagamentos_empresa").delete().eq("id", data.id);
      const mensagemAsaas = e instanceof AsaasError ? e.message : null;
      console.error("criarPagamento (Asaas):", e);
      return {
        error: mensagemAsaas
          ? `Não foi possível criar a cobrança no Asaas: ${mensagemAsaas}`
          : "Não foi possível criar a cobrança no Asaas. Tente novamente.",
      };
    }
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
