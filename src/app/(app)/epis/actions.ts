"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

function parseCustoMedio(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Vida útil é uma estimativa interna de planejamento, não uma exigência
 * legal com prazo fixo (a NR-06 não define um período único de troca para
 * todo EPI — varia por tipo, uso e orientação do fabricante). Por isso o
 * campo é sempre opcional.
 */
function parseVidaUtilDias(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function buildEpiPayload(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "").trim();
  const exigeCa = formData.get("exige_ca") === "on";
  const ca = String(formData.get("ca") ?? "").trim();
  const caValidade = String(formData.get("ca_validade") ?? "").trim();
  const vidaUtilDiasRaw = String(formData.get("vida_util_dias") ?? "");
  const fornecedor = String(formData.get("fornecedor") ?? "").trim();
  const custoMedioRaw = String(formData.get("custo_medio_atual") ?? "");

  return {
    nome,
    tipo: tipo || null,
    exige_ca: exigeCa,
    ca: exigeCa ? ca || null : null,
    ca_validade: exigeCa && caValidade ? caValidade : null,
    vida_util_dias: parseVidaUtilDias(vidaUtilDiasRaw),
    fornecedor: fornecedor || null,
    custo_medio_atual: parseCustoMedio(custoMedioRaw),
    // usado só pra validação abaixo, não vai pro insert/update
    _exigeCaSemNumero: exigeCa && !ca,
  };
}

export type CreateEpiState = { error: string | null; success?: boolean };

export async function createEpi(
  _prevState: CreateEpiState,
  formData: FormData,
): Promise<CreateEpiState> {
  const payload = buildEpiPayload(formData);

  if (!payload.nome) {
    return { error: "Digite o nome do EPI." };
  }
  if (payload._exigeCaSemNumero) {
    return {
      error: 'Informe o número do C.A. ou desmarque "Exige C.A.".',
    };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const { _exigeCaSemNumero, ...dados } = payload;
  void _exigeCaSemNumero;

  const supabase = await createClient();
  const { error } = await supabase.from("epis").insert({
    empresa_id: user.empresaId,
    ...dados,
  });

  if (error) {
    console.error("createEpi:", error.message);
    return { error: "Não foi possível salvar o EPI. Tente novamente." };
  }

  revalidatePath("/epis");
  return { error: null, success: true };
}

export type UpdateEpiState = { error: string | null; success?: boolean };

export async function updateEpi(
  _prevState: UpdateEpiState,
  formData: FormData,
): Promise<UpdateEpiState> {
  const id = String(formData.get("id") ?? "").trim();
  const payload = buildEpiPayload(formData);

  if (!id) {
    return { error: "EPI inválido." };
  }
  if (!payload.nome) {
    return { error: "Digite o nome do EPI." };
  }
  if (payload._exigeCaSemNumero) {
    return {
      error: 'Informe o número do C.A. ou desmarque "Exige C.A.".',
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const { _exigeCaSemNumero, ...dados } = payload;
  void _exigeCaSemNumero;

  const supabase = await createClient();
  const { error } = await supabase.from("epis").update(dados).eq("id", id);

  if (error) {
    console.error("updateEpi:", error.message);
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
    };
  }

  revalidatePath("/epis");
  return { error: null, success: true };
}

export type DesativarEpiState = { error: string | null; success?: boolean };

/**
 * Desativação = soft delete (ativo -> false), nunca DELETE físico: EPIs já
 * usados em entregas/estoque não podem ser removidos do banco sem perder o
 * histórico de conformidade. Diferente do desligamento de colaborador, não
 * exige reautenticação nem download de ficha — desativar um item do catálogo
 * não carrega a mesma implicação trabalhista, então fica no mesmo nível de
 * permissão de criar/editar ("encarregado"+), não reservado a "admin".
 */
export async function desativarEpi(epiId: string): Promise<DesativarEpiState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("epis")
    .update({ ativo: false })
    .eq("id", epiId);

  if (error) {
    console.error("desativarEpi:", error.message);
    return { error: "Não foi possível desativar o EPI. Tente novamente." };
  }

  revalidatePath("/epis");
  return { error: null, success: true };
}

export type ReativarEpiState = { error: string | null; success?: boolean };

export async function reativarEpi(epiId: string): Promise<ReativarEpiState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("epis")
    .update({ ativo: true })
    .eq("id", epiId);

  if (error) {
    console.error("reativarEpi:", error.message);
    return { error: "Não foi possível reativar o EPI. Tente novamente." };
  }

  revalidatePath("/epis");
  return { error: null, success: true };
}
