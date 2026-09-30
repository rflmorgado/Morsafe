"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

export type RegistrarEntradaState = { error: string | null; success?: boolean };

/**
 * Registra uma compra (entrada de estoque). Só faz o INSERT em
 * `entradas_estoque` — o saldo (`estoque.saldo_atual`) e o custo médio
 * (`epis.custo_medio_atual`) são recalculados sozinhos pelo trigger
 * `fn_registrar_entrada_estoque` (ver morsafe-schema.sql), que também cria
 * a linha em `estoque` na primeira entrada de um EPI, pelo método de custo
 * médio ponderado já combinado com o Rafael (ver comentário no topo de
 * epis/actions.ts). O app nunca escreve direto em `estoque` nem em
 * `epis.custo_medio_atual` a partir daqui — só nessa tabela de origem.
 *
 * Mesmo nível de permissão de cadastrar/editar EPI ("encarregado"+): é uma
 * ação operacional de rotina, não mais sensível que isso.
 */
export async function registrarEntradaEstoque(
  _prevState: RegistrarEntradaState,
  formData: FormData,
): Promise<RegistrarEntradaState> {
  const epiId = String(formData.get("epi_id") ?? "").trim();
  const quantidadeRaw = String(formData.get("quantidade") ?? "");
  const precoUnitarioRaw = String(formData.get("preco_unitario") ?? "");
  const fornecedor = String(formData.get("fornecedor") ?? "").trim();
  const notaFiscal = String(formData.get("nota_fiscal") ?? "").trim();
  const dataCompra = String(formData.get("data_compra") ?? "").trim();

  if (!epiId) {
    return { error: "Selecione o EPI." };
  }

  const quantidade = Number(quantidadeRaw);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return { error: "Informe uma quantidade válida (maior que zero)." };
  }

  const precoUnitario = Number(precoUnitarioRaw.replace(",", "."));
  if (!Number.isFinite(precoUnitario) || precoUnitario < 0) {
    return { error: "Informe um preço unitário válido." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  // Confirma que o EPI é da MESMA empresa de quem está registrando, antes
  // de inserir — mesma checagem de posse já usada em colaboradores/EPIs/
  // estações, pra não depender só do RLS pra recusar um id de outra
  // empresa cliente.
  const { data: epi, error: epiError } = await supabase
    .from("epis")
    .select("nome, empresa_id, ativo")
    .eq("id", epiId)
    .maybeSingle();

  if (epiError || !epi || epi.empresa_id !== user.empresaId) {
    return { error: "EPI não encontrado." };
  }
  if (!epi.ativo) {
    return {
      error:
        "Este EPI está desativado — reative-o antes de registrar uma entrada de estoque.",
    };
  }

  const quantidadeArredondada = Math.round(quantidade);

  const { data: novaEntrada, error } = await supabase
    .from("entradas_estoque")
    .insert({
      empresa_id: user.empresaId,
      epi_id: epiId,
      quantidade: quantidadeArredondada,
      preco_unitario: precoUnitario,
      fornecedor: fornecedor || null,
      nota_fiscal: notaFiscal || null,
      criado_por: user.id,
      // Omite a chave quando vazio, em vez de mandar string vazia — deixa
      // o default `current_date` da coluna assumir a data de hoje.
      ...(dataCompra ? { data_compra: dataCompra } : {}),
    })
    .select("id")
    .single();

  if (error || !novaEntrada) {
    console.error("registrarEntradaEstoque:", error?.message);
    return {
      error: "Não foi possível registrar a entrada de estoque. Tente novamente.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "entradas_estoque",
    registroId: novaEntrada.id,
    acao: "entrada_registrada",
    usuarioId: user.id,
    detalhes: { nome: epi.nome, quantidade: quantidadeArredondada },
  });

  revalidatePath("/estoque");
  revalidatePath("/epis"); // custo médio do EPI pode ter mudado
  revalidatePath("/dashboard"); // card de estoque baixo (vw_estoque_baixo)
  return { error: null, success: true };
}

export type AtualizarLimiteState = { error: string | null; success?: boolean };

/**
 * Ajusta só o limite a partir do qual um EPI passa a contar como "estoque
 * baixo" (destaque nesta tela e no card do Dashboard) — nunca mexe no
 * saldo. Upsert com onConflict em epi_id (chave primária de `estoque`)
 * porque um EPI sem nenhuma entrada de compra ainda pode não ter linha
 * nessa tabela (só o trigger de entrada a cria automaticamente); aqui pode
 * ser a primeira vez que a linha passa a existir, com saldo 0 (default da
 * coluna). Como `saldo_atual` não entra no payload, um upsert sobre uma
 * linha já existente nunca sobrescreve o saldo — só `limite_alerta` muda.
 */
export async function atualizarLimiteAlerta(
  epiId: string,
  novoLimite: number,
): Promise<AtualizarLimiteState> {
  if (!Number.isFinite(novoLimite) || novoLimite < 0) {
    return { error: "Informe um limite de alerta válido (zero ou mais)." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const { data: epi, error: epiError } = await supabase
    .from("epis")
    .select("nome, empresa_id")
    .eq("id", epiId)
    .maybeSingle();

  if (epiError || !epi || epi.empresa_id !== user.empresaId) {
    return { error: "EPI não encontrado." };
  }

  const limiteArredondado = Math.round(novoLimite);

  const { error } = await supabase.from("estoque").upsert(
    {
      epi_id: epiId,
      empresa_id: user.empresaId,
      limite_alerta: limiteArredondado,
    },
    { onConflict: "epi_id" },
  );

  if (error) {
    console.error("atualizarLimiteAlerta:", error.message);
    return {
      error: "Não foi possível salvar o limite de alerta. Tente novamente.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "estoque",
    registroId: epiId,
    acao: "limite_atualizado",
    usuarioId: user.id,
    detalhes: { nome: epi.nome, limite: limiteArredondado },
  });

  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
