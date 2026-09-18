"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

export type CreateSetorState = {
  error: string | null;
  id?: string;
  nome?: string;
};

/**
 * Cria um setor novo "no percurso" (opção "Outro" nos formulários de
 * colaborador), para quando surge um setor que ainda não está cadastrado.
 * setores.unidade_id é obrigatório no banco; como o app ainda não tem uma
 * tela de gestão de unidades, usamos a unidade mais antiga da empresa como
 * padrão — hoje a grande maioria das empresas cadastradas tem uma única
 * unidade.
 */
export async function createSetor(nome: string): Promise<CreateSetorState> {
  const nomeTrim = nome.trim();
  if (!nomeTrim) {
    return { error: "Digite o nome do setor." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const { data: unidade, error: unidadeError } = await supabase
    .from("unidades")
    .select("id")
    .eq("empresa_id", user.empresaId)
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (unidadeError || !unidade) {
    console.error("createSetor (unidade):", unidadeError?.message);
    return { error: "Não foi possível identificar a unidade da empresa." };
  }

  const { data, error } = await supabase
    .from("setores")
    .insert({ empresa_id: user.empresaId, unidade_id: unidade.id, nome: nomeTrim })
    .select("id, nome")
    .single();

  if (error || !data) {
    console.error("createSetor:", error?.message);
    return { error: "Não foi possível criar o setor. Tente novamente." };
  }

  revalidatePath("/colaboradores");
  return { error: null, id: data.id, nome: data.nome };
}

export type CreateCargoState = {
  error: string | null;
  id?: string;
  nome?: string;
};

/**
 * Cria uma função (cargo) nova "no percurso", ligada ao setor informado —
 * mesma ideia da opção "Outro" para setor, mas para o caso de o setor já
 * existir e só faltar a função/cargo específico.
 */
export async function createCargo(
  setorId: string,
  nome: string,
): Promise<CreateCargoState> {
  const nomeTrim = nome.trim();
  if (!setorId) {
    return { error: "Selecione um setor antes de criar a função." };
  }
  if (!nomeTrim) {
    return { error: "Digite o nome da função." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cargos")
    .insert({ empresa_id: user.empresaId, setor_id: setorId, nome: nomeTrim })
    .select("id, nome")
    .single();

  if (error || !data) {
    console.error("createCargo:", error?.message);
    return { error: "Não foi possível criar a função. Tente novamente." };
  }

  revalidatePath("/colaboradores");
  return { error: null, id: data.id, nome: data.nome };
}

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
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
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

export type ImportarColaboradorRow = {
  nome: string;
  setorId: string;
  cargoId: string;
  cpf?: string | null;
  telefone?: string | null;
};

export type ImportarColaboradoresState = {
  error: string | null;
  inserted?: number;
};

/**
 * Importação em massa — recebe linhas já validadas e mapeadas no cliente
 * (setor/cargo já resolvidos para id) e insere tudo de uma vez. A validação
 * de nome/setor/cargo acontece no componente cliente antes de chegar aqui;
 * esta action confia nos ids recebidos e deixa a FK do banco barrar
 * qualquer id inválido.
 */
export async function importarColaboradores(
  rows: ImportarColaboradorRow[],
): Promise<ImportarColaboradoresState> {
  if (!rows.length) {
    return { error: "Nenhuma linha válida para importar." };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const payload = rows.map((r) => ({
    empresa_id: user.empresaId as string,
    nome: r.nome,
    setor_id: r.setorId,
    cargo_id: r.cargoId,
    cpf: r.cpf || null,
    telefone: r.telefone || null,
  }));

  const { error, count } = await supabase
    .from("colaboradores")
    .insert(payload, { count: "exact" });

  if (error) {
    console.error("importarColaboradores:", error.message);
    return {
      error: "Não foi possível importar os colaboradores. Tente novamente.",
    };
  }

  revalidatePath("/colaboradores");
  return { error: null, inserted: count ?? payload.length };
}

export type UpdateColaboradorState = {
  error: string | null;
  success?: boolean;
};

/**
 * Edição de cadastro — permite corrigir dados e, principalmente, mudar
 * setor/cargo em caso de promoção ou transferência interna, sem precisar
 * desligar e recadastrar o colaborador.
 */
export async function updateColaborador(
  _prevState: UpdateColaboradorState,
  formData: FormData,
): Promise<UpdateColaboradorState> {
  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const setorId = String(formData.get("setor_id") ?? "").trim();
  const cargoId = String(formData.get("cargo_id") ?? "").trim();
  const cpf = String(formData.get("cpf") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();

  if (!id) {
    return { error: "Colaborador inválido." };
  }
  if (!nome || !setorId || !cargoId) {
    return { error: "Preencha nome, setor e cargo." };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("colaboradores")
    .update({
      nome,
      setor_id: setorId,
      cargo_id: cargoId,
      cpf: cpf || null,
      telefone: telefone || null,
    })
    .eq("id", id);

  if (error) {
    console.error("updateColaborador:", error.message);
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
    };
  }

  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${id}`);
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
 * novo que existe uma sessão válida e que o papel do usuário permite essa
 * ação antes de aplicar a mudança. Desligar exige papel "admin" — é a ação
 * mais sensível da tela, então fica reservada a quem tem mais confiança.
 */
export async function desligarColaborador(
  colaboradorId: string,
): Promise<DesligarColaboradorState> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
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

export type ReativarColaboradorState = {
  error: string | null;
  success?: boolean;
};

/**
 * Reativação — simétrica ao desligamento (volta o status para 'ativo').
 * Não exige reautenticação por senha nem download de ficha: reativar não
 * tem o mesmo peso de conformidade de desligar, já que não está removendo
 * ninguém do controle de EPI, só voltando a acompanhar. Ainda assim exige
 * papel "admin", mesmo nível de desligar, já que é o par inverso da mesma
 * ação sensível.
 */
export async function reativarColaborador(
  colaboradorId: string,
): Promise<ReativarColaboradorState> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("colaboradores")
    .update({ status: "ativo" })
    .eq("id", colaboradorId);

  if (error) {
    console.error("reativarColaborador:", error.message);
    return {
      error: "Não foi possível reativar o colaborador. Tente novamente.",
    };
  }

  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { error: null, success: true };
}
