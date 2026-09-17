"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";

export type CreateColaboradorState = {
  error: string | null;
  success?: boolean;
};

export async function createColaborador(
  _prevState: CreateColaboradorState,
  formData: FormData,
): Promise<CreateColaboradorState> {
  const nome = String(formData.get("nome") ?? "").trim();
  const setorId = String(formData.get("setor_id") ?? "").trim();
  const cargoId = String(formData.get("cargo_id") ?? "").trim();
  const cpf = String(formData.get("cpf") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();

  if (!nome || !setorId || !cargoId) {
    return { error: "Preencha nome, setor e cargo." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("colaboradores").insert({
    empresa_id: user.empresaId,
    nome,
    setor_id: setorId,
    cargo_id: cargoId,
    cpf: cpf || null,
    telefone: telefone || null,
  });

  if (error) {
    console.error("createColaborador:", error.message);
    return { error: "Não foi possível salvar o colaborador. Tente novamente." };
  }

  revalidatePath("/colaboradores");
  return { error: null, success: true };
}

export type DesligarColaboradorState = {
  error: string | null;
  success?: boolean;
};

/**
 * Desligamento = soft delete (status -> 'inativo'). Nunca um DELETE real:
 * a FK entregas.colaborador_id é ON DELETE RESTRICT, então um colaborador
 * com qualquer histórico de entrega jamais pode ser excluído fisicamente
 * do banco — e isso é o comportamento correto para manter o histórico de
 * conformidade da NR-06.
 *
 * A reautenticação por senha é validada no cliente (supabase.auth.
 * signInWithPassword) antes desta action ser chamada; aqui confirmamos de
 * novo que existe uma sessão válida antes de aplicar a mudança.
 */
export async function desligarColaborador(
  colaboradorId: string,
): Promise<DesligarColaboradorState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase
    .from("colaboradores")
    .update({ status: "inativo" })
    .eq("id", colaboradorId);

  if (error) {
    console.error("desligarColaborador:", error.message);
    return { error: "Não foi possível desligar o colaborador. Tente novamente." };
  }

  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { error: null, success: true };
}
