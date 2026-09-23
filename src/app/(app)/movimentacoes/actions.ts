"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";
import {
  listEntregasEmPosse,
  type EntregaEmPosse,
} from "@/lib/data/movimentacoes";
import type {
  MotivoEntrega,
  MotivoDevolucao,
  DestinoDevolucao,
} from "@/types/database";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

/**
 * Ajusta (soma ou subtrai) o saldo de estoque de um EPI — chamado ao
 * registrar uma entrega (baixa 1 unidade) ou uma devolução com destino
 * "reaproveitamento" (devolve 1 unidade). Best-effort: se falhar, só loga o
 * erro no servidor e não desfaz a movimentação principal (mesmo raciocínio
 * de registrarLogAuditoria) — o registro de entrega/devolução em si, que é
 * o que importa pra conformidade com a NR-06, já foi salvo com sucesso
 * antes desta chamada. Cria a linha em `estoque` na primeira movimentação
 * de um EPI que ainda não tinha nenhuma — a futura tela de Estoque só vai
 * gerenciar entradas de compra em cima do saldo que já existir aqui.
 */
async function ajustarEstoque(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  epiId: string,
  delta: number,
) {
  try {
    const { data: atual } = await supabase
      .from("estoque")
      .select("saldo_atual")
      .eq("epi_id", epiId)
      .maybeSingle();

    if (atual) {
      await supabase
        .from("estoque")
        .update({ saldo_atual: atual.saldo_atual + delta })
        .eq("epi_id", epiId);
    } else {
      await supabase
        .from("estoque")
        .insert({ epi_id: epiId, empresa_id: empresaId, saldo_atual: delta });
    }
  } catch (e) {
    console.error("ajustarEstoque:", e);
  }
}

export type RegistrarEntregaState = { error: string | null; success?: boolean };

/**
 * Registra a entrega de um EPI a um colaborador. custo_unitario_no_momento
 * é sempre lido do cadastro do EPI no momento da entrega (nunca digitado no
 * formulário) — é um "retrato" do custo naquela data, que não deve mudar
 * depois mesmo que o custo médio do EPI mude no catálogo.
 */
export async function registrarEntrega(
  _prevState: RegistrarEntregaState,
  formData: FormData,
): Promise<RegistrarEntregaState> {
  const colaboradorId = String(formData.get("colaborador_id") ?? "").trim();
  const epiId = String(formData.get("epi_id") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim() as MotivoEntrega;
  const data = String(formData.get("data") ?? "").trim();
  const hora = String(formData.get("hora") ?? "").trim();
  const assinaturaUrl = String(formData.get("assinatura_url") ?? "").trim();
  const quantidade = Number(formData.get("quantidade") ?? 1);

  if (!colaboradorId || !epiId || !motivo || !data || !hora) {
    return { error: "Preencha colaborador, EPI, motivo, data e hora." };
  }
  if (!assinaturaUrl) {
    return { error: "Colete a assinatura de confirmação do recebimento." };
  }
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    return { error: "Quantidade deve ser um número inteiro de pelo menos 1." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const [{ data: colaborador }, { data: epi }] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("nome, status")
      .eq("id", colaboradorId)
      .maybeSingle(),
    supabase
      .from("epis")
      .select("nome, ativo, custo_medio_atual")
      .eq("id", epiId)
      .maybeSingle(),
  ]);

  if (!colaborador || colaborador.status !== "ativo") {
    return { error: "Colaborador inválido ou já desligado." };
  }
  if (!epi || !epi.ativo) {
    return { error: "EPI inválido ou desativado." };
  }

  const { data: nova, error } = await supabase
    .from("entregas")
    .insert({
      empresa_id: user.empresaId,
      colaborador_id: colaboradorId,
      epi_id: epiId,
      data,
      hora,
      motivo,
      quantidade,
      assinatura_url: assinaturaUrl,
      custo_unitario_no_momento: epi.custo_medio_atual,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error || !nova) {
    console.error("registrarEntrega:", error?.message);
    return { error: "Não foi possível registrar a entrega. Tente novamente." };
  }

  await ajustarEstoque(supabase, user.empresaId, epiId, -quantidade);

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "entregas",
    registroId: nova.id,
    acao: "criado",
    usuarioId: user.id,
    detalhes: { nome: `${colaborador.nome} — ${epi.nome}`, quantidade },
  });

  revalidatePath("/movimentacoes");
  revalidatePath(`/colaboradores/${colaboradorId}`);
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export type RegistrarDevolucaoState = { error: string | null; success?: boolean };

/**
 * Registra a devolução de um EPI — sempre vinculada a uma entrega específica
 * ainda não devolvida (entrega_vinculada_id), nunca a um EPI "qualquer" do
 * catálogo. É essa entrega escolhida no formulário que também define qual
 * epi_id vai para o registro, preservando o vínculo entrega -> devolução.
 */
export async function registrarDevolucao(
  _prevState: RegistrarDevolucaoState,
  formData: FormData,
): Promise<RegistrarDevolucaoState> {
  const colaboradorId = String(formData.get("colaborador_id") ?? "").trim();
  const entregaVinculadaId = String(
    formData.get("entrega_vinculada_id") ?? "",
  ).trim();
  const epiId = String(formData.get("epi_id") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim() as MotivoDevolucao;
  const destino = String(formData.get("destino") ?? "").trim() as DestinoDevolucao;
  const devolvidoFisicamente = formData.get("devolvido_fisicamente") === "on";
  const data = String(formData.get("data") ?? "").trim();
  // Quantidade da entrega vinculada (não é digitada aqui) — devolução
  // sempre baixa a entrega inteira, ver comentário em EntregaEmPosse.
  const quantidade = Number(formData.get("quantidade") ?? 1);

  if (
    !colaboradorId ||
    !entregaVinculadaId ||
    !epiId ||
    !motivo ||
    !destino ||
    !data
  ) {
    return {
      error:
        "Selecione o colaborador, o EPI entregue, o motivo, o destino e a data.",
    };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const [{ data: colaborador }, { data: epi }] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("nome")
      .eq("id", colaboradorId)
      .maybeSingle(),
    supabase.from("epis").select("nome").eq("id", epiId).maybeSingle(),
  ]);

  if (!colaborador) return { error: "Colaborador não encontrado." };
  if (!epi) return { error: "EPI não encontrado." };

  const { data: nova, error } = await supabase
    .from("devolucoes")
    .insert({
      empresa_id: user.empresaId,
      colaborador_id: colaboradorId,
      epi_id: epiId,
      entrega_vinculada_id: entregaVinculadaId,
      data,
      motivo,
      destino,
      devolvido_fisicamente: devolvidoFisicamente,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error || !nova) {
    console.error("registrarDevolucao:", error?.message);
    return {
      error: "Não foi possível registrar a devolução. Tente novamente.",
    };
  }

  if (devolvidoFisicamente && destino === "reaproveitamento") {
    const creditoValido = Number.isInteger(quantidade) && quantidade > 0 ? quantidade : 1;
    await ajustarEstoque(supabase, user.empresaId, epiId, creditoValido);
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "devolucoes",
    registroId: nova.id,
    acao: "criado",
    usuarioId: user.id,
    detalhes: { nome: `${colaborador.nome} — ${epi.nome}`, quantidade },
  });

  revalidatePath("/movimentacoes");
  revalidatePath(`/colaboradores/${colaboradorId}`);
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export type RegistrarRecusaState = { error: string | null; success?: boolean };

/**
 * Registra a recusa de um colaborador em usar/receber um EPI — junto com o
 * motivo (obrigatório aqui mesmo sendo opcional no banco: sem o motivo, o
 * registro não serve pra nada em caso de fiscalização ou acidente).
 */
export async function registrarRecusa(
  _prevState: RegistrarRecusaState,
  formData: FormData,
): Promise<RegistrarRecusaState> {
  const colaboradorId = String(formData.get("colaborador_id") ?? "").trim();
  const epiId = String(formData.get("epi_id") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  const hora = String(formData.get("hora") ?? "").trim();
  const testemunha = String(formData.get("testemunha") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim();

  if (!colaboradorId || !epiId || !data || !hora) {
    return { error: "Preencha colaborador, EPI, data e hora." };
  }
  if (!observacoes) {
    return { error: "Descreva o motivo da recusa." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const [{ data: colaborador }, { data: epi }] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("nome, status")
      .eq("id", colaboradorId)
      .maybeSingle(),
    supabase.from("epis").select("nome, ativo").eq("id", epiId).maybeSingle(),
  ]);

  if (!colaborador || colaborador.status !== "ativo") {
    return { error: "Colaborador inválido ou já desligado." };
  }
  if (!epi || !epi.ativo) {
    return { error: "EPI inválido ou desativado." };
  }

  const { data: nova, error } = await supabase
    .from("recusas")
    .insert({
      empresa_id: user.empresaId,
      colaborador_id: colaboradorId,
      epi_id: epiId,
      data,
      hora,
      testemunha: testemunha || null,
      observacoes,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error || !nova) {
    console.error("registrarRecusa:", error?.message);
    return { error: "Não foi possível registrar a recusa. Tente novamente." };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "recusas",
    registroId: nova.id,
    acao: "criado",
    usuarioId: user.id,
    detalhes: { nome: `${colaborador.nome} — ${epi.nome}` },
  });

  revalidatePath("/movimentacoes");
  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { error: null, success: true };
}

/**
 * Usado pelo formulário de devolução: ao escolher o colaborador, busca (via
 * Server Action, sem precisar de uma rota própria) os EPIs que ele tem "em
 * posse" pra popular o segundo select — ver comentário em
 * lib/data/movimentacoes.ts (listEntregasEmPosse).
 */
export async function buscarEntregasEmPosse(
  colaboradorId: string,
): Promise<EntregaEmPosse[]> {
  const user = await getCurrentUser();
  if (!user?.empresaId || !colaboradorId) return [];
  return listEntregasEmPosse(colaboradorId);
}
