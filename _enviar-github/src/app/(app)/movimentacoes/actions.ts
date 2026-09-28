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
 * catálogo. epi_id e quantidade do registro vêm sempre da entrega vinculada
 * (relidos do banco aqui, nunca do formulário), e colaborador_id é
 * conferido contra o colaborador_id da própria entrega antes de gravar —
 * ver comentário mais abaixo.
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

  const [{ data: colaborador }, { data: entregaValida }] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("nome")
      .eq("id", colaboradorId)
      .maybeSingle(),
    supabase
      .from("entregas")
      .select("colaborador_id, epi_id, quantidade, epis ( nome )")
      .eq("id", entregaVinculadaId)
      .maybeSingle(),
  ]);

  if (!colaborador) return { error: "Colaborador não encontrado." };

  // A checagem que faltava: colaborador_id e entrega_vinculada_id chegam do
  // formulário como dois campos independentes, preenchidos a partir de dois
  // estados de UI diferentes (select de colaborador + item escolhido na
  // lista "em posse", carregada à parte via buscarEntregasEmPosse). Numa
  // troca rápida de colaborador com resposta de rede fora de ordem, essa
  // lista podia ficar mostrando por um instante os EPIs do colaborador
  // ANTERIOR (mitigado agora no cliente, ver registrar-devolucao-button.tsx)
  // — mas o servidor não pode depender só disso. Sem esta conferência aqui,
  // a devolução seria gravada vinculada ao colaborador errado numa tabela
  // imutável por design (CLAUDE.md, regra 3). Pelo mesmo motivo, epi_id e
  // quantidade nunca vêm do formulário: usamos sempre o que está de fato
  // gravado na entrega vinculada.
  if (!entregaValida || entregaValida.colaborador_id !== colaboradorId) {
    return {
      error:
        "Essa entrega não pertence (mais) ao colaborador selecionado. Feche e abra o formulário de novo.",
    };
  }

  // Trava contra devolver a mesma entrega duas vezes (double-submit, ou o
  // mesmo cenário de resposta fora de ordem citado acima) — cada entrega só
  // pode ter uma devolução vinculada.
  const { data: devolucaoExistente } = await supabase
    .from("devolucoes")
    .select("id")
    .eq("entrega_vinculada_id", entregaVinculadaId)
    .maybeSingle();
  if (devolucaoExistente) {
    return { error: "Esta entrega já foi devolvida anteriormente." };
  }

  const epi = entregaValida.epis as unknown as { nome: string } | null;
  if (!epi) return { error: "EPI não encontrado." };
  const epiIdReal = entregaValida.epi_id;
  const quantidadeReal = entregaValida.quantidade;

  const { data: nova, error } = await supabase
    .from("devolucoes")
    .insert({
      empresa_id: user.empresaId,
      colaborador_id: colaboradorId,
      epi_id: epiIdReal,
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
    await ajustarEstoque(supabase, user.empresaId, epiIdReal, quantidadeReal);
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "devolucoes",
    registroId: nova.id,
    acao: "criado",
    usuarioId: user.id,
    detalhes: {
      nome: `${colaborador.nome} — ${epi.nome}`,
      quantidade: quantidadeReal,
    },
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

/**
 * Usado pelo formulário de entrega: ao escolher o EPI, busca o saldo atual
 * em `estoque` pra avisar (sem bloquear — registrar a entrega é o que
 * importa pra conformidade com a NR-06, ver CLAUDE.md regra 4) quando a
 * quantidade digitada deixaria o saldo negativo. `null` aqui quer dizer
 * "esse EPI ainda não teve nenhuma movimentação de estoque" (ver comentário
 * em ajustarEstoque) — diferente de saldo zero, então o formulário não deve
 * tratar como "sem estoque nenhum".
 */
export async function buscarSaldoEstoque(
  epiId: string,
): Promise<number | null> {
  const user = await getCurrentUser();
  if (!user?.empresaId || !epiId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estoque")
    .select("saldo_atual")
    .eq("epi_id", epiId)
    .maybeSingle();

  if (error) {
    console.error("buscarSaldoEstoque:", error.message);
    return null;
  }
  return data?.saldo_atual ?? null;
}
