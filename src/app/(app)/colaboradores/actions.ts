"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

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

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "setores",
    registroId: data.id,
    acao: "criado",
    usuarioId: user.id,
    detalhes: { nome: data.nome },
  });

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

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "cargos",
    registroId: data.id,
    acao: "criado",
    usuarioId: user.id,
    detalhes: { nome: data.nome },
  });

  revalidatePath("/colaboradores");
  return { error: null, id: data.id, nome: data.nome };
}

export type DeleteCargoState = { error: string | null };

/**
 * Exclui uma função/cargo descontinuado, pra limpar a lista de opções do
 * formulário de colaborador. Só uma limpeza de cadastro — não tem "desativar"
 * aqui como em EPI/colaborador/usuário, porque uma função sem nenhum
 * colaborador vinculado (ver `cargos.setor_id`/`colaboradores.cargo_id
 * ... on delete restrict` no schema) não carrega histórico nenhum: o próprio
 * banco recusa a exclusão (violação de chave estrangeira, código 23503) se
 * ainda houver algum colaborador — ativo OU desligado — com essa função, e
 * é esse erro que vira a mensagem abaixo em vez de travar a tela.
 */
export async function deleteCargo(cargoId: string): Promise<DeleteCargoState> {
  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const { data: cargo } = await supabase
    .from("cargos")
    .select("nome")
    .eq("id", cargoId)
    .maybeSingle();

  const { error } = await supabase.from("cargos").delete().eq("id", cargoId);

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "Não é possível excluir: ainda existem colaboradores (ativos ou desligados) com essa função. Edite o cadastro deles pra trocar a função antes de excluir.",
      };
    }
    console.error("deleteCargo:", error.message);
    return { error: "Não foi possível excluir a função. Tente novamente." };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "cargos",
    registroId: cargoId,
    acao: "excluido",
    usuarioId: user.id,
    detalhes: { nome: cargo?.nome ?? null },
  });

  revalidatePath("/colaboradores");
  return { error: null };
}

export type DeleteSetorState = { error: string | null };

/**
 * Mesma lógica de deleteCargo, um nível acima — só exclui se o setor não
 * tiver nenhuma função nem colaborador vinculado (mesma proteção via chave
 * estrangeira no banco).
 */
export async function deleteSetor(setorId: string): Promise<DeleteSetorState> {
  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const { data: setor } = await supabase
    .from("setores")
    .select("nome")
    .eq("id", setorId)
    .maybeSingle();

  const { error } = await supabase.from("setores").delete().eq("id", setorId);

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "Não é possível excluir: esse setor ainda tem funções ou colaboradores cadastrados nele. Exclua as funções do setor (e mova os colaboradores) antes.",
      };
    }
    console.error("deleteSetor:", error.message);
    return { error: "Não foi possível excluir o setor. Tente novamente." };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "setores",
    registroId: setorId,
    acao: "excluido",
    usuarioId: user.id,
    detalhes: { nome: setor?.nome ?? null },
  });

  revalidatePath("/colaboradores");
  return { error: null };
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
  const dataIntegracaoSeguranca = String(
    formData.get("data_integracao_seguranca") ?? "",
  ).trim();

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
  const { data: novo, error } = await supabase
    .from("colaboradores")
    .insert({
      empresa_id: user.empresaId,
      nome,
      setor_id: setorId,
      cargo_id: cargoId,
      cpf: cpf || null,
      telefone: telefone || null,
      data_integracao_seguranca: dataIntegracaoSeguranca || null,
    })
    .select("id")
    .single();

  if (error || !novo) {
    console.error("createColaborador:", error?.message);
    return { error: "Não foi possível salvar o colaborador. Tente novamente." };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "colaboradores",
    registroId: novo.id,
    acao: "criado",
    usuarioId: user.id,
    detalhes: { nome },
  });

  revalidatePath("/colaboradores");
  return { error: null, success: true };
}

export type ImportarColaboradorRow = {
  // Número da linha na planilha original (cabeçalho = linha 1, ver
  // resolvedRows em importar-colaboradores-button.tsx) — só pra poder
  // apontar exatamente qual linha falhou, ver comentário abaixo.
  linha: number;
  nome: string;
  setorId: string;
  cargoId: string;
  cpf?: string | null;
  telefone?: string | null;
  dataIntegracaoSeguranca?: string | null;
};

export type ImportarColaboradorFalha = {
  linha: number;
  nome: string;
  erro: string;
};

export type ImportarColaboradoresState = {
  error: string | null;
  inserted?: number;
  falhas?: ImportarColaboradorFalha[];
};

/**
 * Importação em massa — recebe linhas já validadas e mapeadas no cliente
 * (setor/cargo já resolvidos para id, CPF duplicado dentro da própria
 * planilha já filtrado na revisão) e insere UMA LINHA DE CADA VEZ, nunca
 * tudo num `.insert(array)` só. É de propósito: um insert em lote é atômico
 * — um único CPF que já existisse em outro colaborador desta empresa
 * (constraint `unique (empresa_id, cpf)`) fazia a importação INTEIRA falhar
 * (as 300 linhas de uma planilha, por exemplo) com um erro genérico, sem
 * dizer qual linha. Inserindo uma por uma, essa linha vira uma falha
 * reportada com o número dela e o motivo, e as outras continuam sendo
 * importadas normalmente.
 *
 * Exige papel "admin" (um nível acima de criar/editar um único colaborador,
 * que pede só "encarregado"): uma importação erra em massa se a planilha ou
 * o mapeamento de colunas estiver errado, então essa ação fica reservada a
 * quem tem mais confiança na empresa — mesmo raciocínio de desligar/reativar.
 * Vale como padrão pra qualquer importação em massa futura no app.
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
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();
  const empresaId = user.empresaId;
  const falhas: ImportarColaboradorFalha[] = [];
  let inserted = 0;

  for (const r of rows) {
    const { error } = await supabase.from("colaboradores").insert({
      empresa_id: empresaId,
      nome: r.nome,
      setor_id: r.setorId,
      cargo_id: r.cargoId,
      cpf: r.cpf || null,
      telefone: r.telefone || null,
      data_integracao_seguranca: r.dataIntegracaoSeguranca || null,
    });

    if (error) {
      // 23505 = unique_violation no Postgres — aqui é sempre a constraint
      // unique (empresa_id, cpf): já existe outro colaborador com esse CPF
      // cadastrado nesta empresa (não detectável no cliente, que só vê os
      // CPFs da própria planilha sendo importada agora).
      const mensagem =
        error.code === "23505"
          ? "CPF já cadastrado em outro colaborador desta empresa."
          : "Não foi possível salvar esta linha.";
      console.error(`importarColaboradores (linha ${r.linha}):`, error.message);
      falhas.push({ linha: r.linha, nome: r.nome, erro: mensagem });
      continue;
    }

    inserted++;
  }

  if (inserted > 0) {
    // Um único registro de log pra importação inteira (não um por linha) —
    // o volume seria alto e o que importa pra auditoria é "quem importou
    // quantos, quando", não cada linha individual.
    await registrarLogAuditoria({
      supabase,
      empresaId,
      tabela: "colaboradores",
      registroId: empresaId,
      acao: "importado",
      usuarioId: user.id,
      detalhes: { quantidade: inserted, falhas: falhas.length },
    });
    revalidatePath("/colaboradores");
  }

  return {
    error: null,
    inserted,
    falhas: falhas.length > 0 ? falhas : undefined,
  };
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
  const dataIntegracaoSeguranca = String(
    formData.get("data_integracao_seguranca") ?? "",
  ).trim();

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

  // Confirma que o colaborador é da MESMA empresa de quem está editando,
  // antes de tentar o update — sem isso, alguém que soubesse (ou
  // adivinhasse) o id de um colaborador de OUTRA empresa cliente poderia
  // tentar editá-lo (ver mesma checagem em estacoes/actions.ts).
  const { data: colaboradorAtual, error: buscaError } = await supabase
    .from("colaboradores")
    .select("empresa_id")
    .eq("id", id)
    .maybeSingle();

  if (
    buscaError ||
    !colaboradorAtual ||
    colaboradorAtual.empresa_id !== user.empresaId
  ) {
    return { error: "Colaborador não encontrado." };
  }

  const { data, error } = await supabase
    .from("colaboradores")
    .update({
      nome,
      setor_id: setorId,
      cargo_id: cargoId,
      cpf: cpf || null,
      telefone: telefone || null,
      data_integracao_seguranca: dataIntegracaoSeguranca || null,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateColaborador:", error.message);
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
    };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: um .update() que não bate com
  // nenhuma linha retorna error: null mesmo sem alterar nada.
  if (!data) {
    console.error(
      "updateColaborador: update não afetou nenhuma linha para id=",
      id,
    );
    return {
      error:
        "Não foi possível confirmar a alteração. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: colaboradorAtual.empresa_id,
    tabela: "colaboradores",
    registroId: id,
    acao: "atualizado",
    usuarioId: user.id,
    detalhes: { nome },
  });

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
  const { data: colaborador } = await supabase
    .from("colaboradores")
    .select("nome")
    .eq("id", colaboradorId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("colaboradores")
    .update({ status: "inativo" })
    .eq("id", colaboradorId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("desligarColaborador:", error.message);
    return { error: "Não foi possível desligar o colaborador. Tente novamente." };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: um .update() que não bate com
  // nenhuma linha retorna error: null mesmo sem desligar ninguém — pra uma
  // ação NR-06 desse porte, "pareceu que salvou" não é bom o suficiente.
  if (!data) {
    console.error(
      "desligarColaborador: update não afetou nenhuma linha para colaboradorId=",
      colaboradorId,
    );
    return {
      error:
        "Não foi possível confirmar o desligamento. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  if (user.empresaId) {
    await registrarLogAuditoria({
      supabase,
      empresaId: user.empresaId,
      tabela: "colaboradores",
      registroId: colaboradorId,
      acao: "desligado",
      usuarioId: user.id,
      detalhes: colaborador ? { nome: colaborador.nome } : null,
    });
  }

  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { error: null, success: true };
}

export type ExcluirColaboradorState = {
  error: string | null;
  success?: boolean;
};

/**
 * Exclusão DEFINITIVA (DELETE físico) — diferente de desligar, que é soft
 * delete. Pensada pro colaborador que não vai voltar e cujo cadastro não
 * precisa mais ocupar a lista de desligados (ex.: cadastro duplicado, erro
 * de digitação, ou a empresa simplesmente quer limpar a lista periodicamente).
 *
 * Duas travas antes de excluir:
 * 1) Só é permitido em cima de um colaborador já desligado (status
 *    'inativo') — a interface só oferece essa opção depois do desligamento.
 * 2) Se existir qualquer histórico vinculado (entrega, devolução ou recusa
 *    de EPI), o próprio banco recusa a exclusão via FK RESTRICT — aqui só
 *    traduzimos esse erro (código Postgres 23503) numa mensagem clara, em
 *    vez de deixar vazar o erro técnico. Esse é o comportamento correto:
 *    um colaborador com qualquer histórico de EPI PRECISA continuar
 *    existindo no banco (mesmo que só desligado) pra manter a rastreabilidade
 *    exigida pela NR-06 — só é seguro excluir de verdade quem nunca chegou
 *    a ter nenhum registro.
 *
 * Exige papel "admin" (mesmo nível de desligar/reativar) e não tem volta —
 * ao contrário do desligamento, não existe "reativar" depois disso.
 */
export async function excluirColaboradorDefinitivamente(
  colaboradorId: string,
): Promise<ExcluirColaboradorState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  const { data: colaborador, error: colaboradorError } = await supabase
    .from("colaboradores")
    .select("status, nome")
    .eq("id", colaboradorId)
    .maybeSingle();

  if (colaboradorError || !colaborador) {
    return { error: "Colaborador não encontrado." };
  }
  if (colaborador.status !== "inativo") {
    return {
      error:
        "Só é possível excluir definitivamente um colaborador que já está desligado.",
    };
  }

  const { error: deleteError } = await supabase
    .from("colaboradores")
    .delete()
    .eq("id", colaboradorId);

  if (deleteError) {
    if (deleteError.code === "23503") {
      return {
        error:
          "Não é possível excluir: este colaborador tem histórico de entrega, devolução ou recusa de EPI vinculado a ele. Pra preservar a conformidade com a NR-06, ele precisa continuar existindo no sistema — mantenha-o desligado.",
      };
    }
    console.error("excluirColaboradorDefinitivamente:", deleteError.message);
    return {
      error: "Não foi possível excluir o colaborador. Tente novamente.",
    };
  }

  if (user.empresaId) {
    await registrarLogAuditoria({
      supabase,
      empresaId: user.empresaId,
      tabela: "colaboradores",
      registroId: colaboradorId,
      acao: "excluido",
      usuarioId: user.id,
      detalhes: { nome: colaborador.nome },
    });
  }

  revalidatePath("/colaboradores");
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
  const { data: colaborador, error: buscaError } = await supabase
    .from("colaboradores")
    .select("nome, empresa_id")
    .eq("id", colaboradorId)
    .maybeSingle();

  if (
    buscaError ||
    !colaborador ||
    colaborador.empresa_id !== user.empresaId
  ) {
    return { error: "Colaborador não encontrado." };
  }

  const { data, error } = await supabase
    .from("colaboradores")
    .update({ status: "ativo" })
    .eq("id", colaboradorId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("reativarColaborador:", error.message);
    return {
      error: "Não foi possível reativar o colaborador. Tente novamente.",
    };
  }
  // Mesma checagem da regra 1 do CLAUDE.md (ver desligarColaborador acima):
  // um .update() que não bate com nenhuma linha retorna error: null mesmo
  // sem reativar ninguém.
  if (!data) {
    console.error(
      "reativarColaborador: update não afetou nenhuma linha para colaboradorId=",
      colaboradorId,
    );
    return {
      error:
        "Não foi possível confirmar a reativação. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: colaborador.empresa_id,
    tabela: "colaboradores",
    registroId: colaboradorId,
    acao: "reativado",
    usuarioId: user.id,
    detalhes: { nome: colaborador.nome },
  });

  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { error: null, success: true };
}
