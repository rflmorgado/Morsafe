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
 *
 * Antes de criar, procura um setor já existente com o MESMO NOME na
 * empresa (ignorando maiúsculas/acentuação de caixa e espaços) e reaproveita
 * ele em vez de criar outro — bug real encontrado em 05/10/2026 (Rafael,
 * ViniPlast/Vinitrade): como `setores` permite o mesmo nome em unidades
 * diferentes (unique é por `unidade_id`, não por empresa — ver comentário
 * no schema), e esta função sempre usava a unidade mais antiga como padrão,
 * digitar de novo um setor que já existia (ex: "PCP") na opção "Outro"
 * criava um SEGUNDO registro com o mesmo nome em vez de reaproveitar o
 * primeiro — a causa dos setores duplicados que apareceram na aba
 * Checklist de campo da Auditoria. Pra quem já tinha setor duplicado antes
 * desse fix, ver `mesclarSetores` logo abaixo.
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

  const { data: setoresExistentes } = await supabase
    .from("setores")
    .select("id, nome")
    .eq("empresa_id", user.empresaId);

  const existente = setoresExistentes?.find(
    (s) => s.nome.trim().toLowerCase() === nomeTrim.toLowerCase(),
  );
  if (existente) {
    return { error: null, id: existente.id, nome: existente.nome };
  }

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

  // Confirma que a função é da MESMA empresa de quem está excluindo, antes
  // de tentar o delete — mesma checagem já usada em
  // excluirColaboradorDefinitivamente/updateEpi, pra não depender só do
  // RLS pra recusar um id de outra empresa cliente.
  const { data: cargo } = await supabase
    .from("cargos")
    .select("nome")
    .eq("id", cargoId)
    .eq("empresa_id", user.empresaId)
    .maybeSingle();

  if (!cargo) {
    return { error: "Função não encontrada." };
  }

  const { data: excluido, error } = await supabase
    .from("cargos")
    .delete()
    .eq("id", cargoId)
    .select("id")
    .maybeSingle();

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
  // Mesma checagem da regra 1 do CLAUDE.md: um .delete() que não bate com
  // nenhuma linha retorna error: null mesmo sem apagar nada.
  if (!excluido) {
    console.error("deleteCargo: delete não afetou nenhuma linha para id=", cargoId);
    return { error: "Não foi possível excluir a função. Tente novamente." };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "cargos",
    registroId: cargoId,
    acao: "excluido",
    usuarioId: user.id,
    detalhes: { nome: cargo.nome },
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

  // Confirma que o setor é da MESMA empresa de quem está excluindo, antes
  // de tentar o delete — mesma checagem já usada em
  // excluirColaboradorDefinitivamente/updateEpi, pra não depender só do
  // RLS pra recusar um id de outra empresa cliente.
  const { data: setor } = await supabase
    .from("setores")
    .select("nome")
    .eq("id", setorId)
    .eq("empresa_id", user.empresaId)
    .maybeSingle();

  if (!setor) {
    return { error: "Setor não encontrado." };
  }

  const { data: excluido, error } = await supabase
    .from("setores")
    .delete()
    .eq("id", setorId)
    .select("id")
    .maybeSingle();

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
  // Mesma checagem da regra 1 do CLAUDE.md: um .delete() que não bate com
  // nenhuma linha retorna error: null mesmo sem apagar nada.
  if (!excluido) {
    console.error("deleteSetor: delete não afetou nenhuma linha para id=", setorId);
    return { error: "Não foi possível excluir o setor. Tente novamente." };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "setores",
    registroId: setorId,
    acao: "excluido",
    usuarioId: user.id,
    detalhes: { nome: setor.nome },
  });

  revalidatePath("/colaboradores");
  return { error: null };
}

export type MesclarSetoresState = { error: string | null };

/**
 * Mescla um setor duplicado (origem) dentro de outro (destino) — limpeza
 * pedida pelo Rafael, 05/10/2026, pra corrigir setores duplicados criados
 * antes do fix em `createSetor` acima (mesmo setor, ex: "PCP", cadastrado
 * duas vezes por causa da unidade padrão). Diferente de deleteSetor (que só
 * funciona com o setor vazio), esta função MOVE tudo que está no setor de
 * origem para o de destino antes de apagar a origem — nenhum colaborador,
 * função ou EPI obrigatório se perde, só passam a apontar pro setor de
 * destino:
 *
 * 1. Funções (cargos): uma função do setor origem com o MESMO NOME de uma
 *    função já existente no destino é mesclada nela (colaboradores daquela
 *    função passam pra função equivalente do destino, e a função duplicada
 *    é excluída); sem nome igual, a função é só movida pro setor destino
 *    (sem duplicar).
 * 2. Colaboradores: todos os colaboradores do setor origem (mesmo quem já
 *    teve a função movida no passo 1) passam a apontar pro setor destino —
 *    `setor_id` é um campo independente de `cargo_id`.
 * 3. EPIs obrigatórios (setor_epi): se um EPI é obrigatório em QUALQUER um
 *    dos dois setores, fica obrigatório no destino depois da mescla (união,
 *    nunca interseção) — é a opção mais segura pra conformidade: nunca
 *    reduz uma exigência que já existia em algum dos dois lados.
 * 4. Histórico de Checklist de campo (auditorias_nr06): auditorias já
 *    registradas no setor origem passam a aparecer no destino — o conteúdo
 *    de cada auditoria (respostas às 8 perguntas) não muda, só o setor ao
 *    qual ela fica associada.
 * 5. Só então o setor origem (já vazio) é excluído.
 *
 * Feito em chamadas sequenciais (o cliente do Supabase usado aqui não
 * oferece transação entre tabelas — mesma limitação de
 * resetarDadosEmpresa/excluirEmpresaPermanentemente em empresas/actions.ts),
 * então a ordem importa: funções e EPIs primeiro (pra não esbarrar na
 * constraint de nome único quando uma função for movida sem mesclar),
 * colaboradores depois, setor origem por último — só quando já não há mais
 * nada apontando pra ele.
 *
 * Exige papel "admin" (mais alto que criar/excluir um setor isolado,
 * "encarregado") — mexe de uma vez em colaboradores, funções e exigências
 * de EPI de toda a empresa, e não tem como desfazer com um clique.
 */
export async function mesclarSetores(
  setorOrigemId: string,
  setorDestinoId: string,
): Promise<MesclarSetoresState> {
  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }
  if (setorOrigemId === setorDestinoId) {
    return { error: "Escolha dois setores diferentes para mesclar." };
  }
  // Capturado numa const: `user.empresaId` já foi confirmado não-nulo acima,
  // mas o TypeScript não carrega esse estreitamento pra dentro das closures
  // mais abaixo (ex: o `Array.from` do passo 3) — por isso a variável à
  // parte, em vez de `user.empresaId` repetido.
  const empresaId = user.empresaId;

  const supabase = await createClient();

  // Confirma que os dois setores são da MESMA empresa de quem está
  // mesclando — mesma checagem de posse já usada em deleteSetor/deleteCargo,
  // pra não depender só do RLS pra recusar um id de outra empresa cliente.
  const { data: setores } = await supabase
    .from("setores")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .in("id", [setorOrigemId, setorDestinoId]);

  const origem = setores?.find((s) => s.id === setorOrigemId);
  const destino = setores?.find((s) => s.id === setorDestinoId);
  if (!origem || !destino) {
    return { error: "Setor não encontrado." };
  }

  // ---- 1. Funções (cargos): mescla por nome igual, move o resto ----
  const [{ data: cargosOrigem }, { data: cargosDestino }] = await Promise.all([
    supabase.from("cargos").select("id, nome").eq("setor_id", setorOrigemId),
    supabase.from("cargos").select("id, nome").eq("setor_id", setorDestinoId),
  ]);

  for (const cargoOrigem of cargosOrigem ?? []) {
    const cargoDestinoEquivalente = (cargosDestino ?? []).find(
      (c) => c.nome.trim().toLowerCase() === cargoOrigem.nome.trim().toLowerCase(),
    );

    if (cargoDestinoEquivalente) {
      const { error: moverColaboradoresError } = await supabase
        .from("colaboradores")
        .update({ cargo_id: cargoDestinoEquivalente.id })
        .eq("cargo_id", cargoOrigem.id);
      if (moverColaboradoresError) {
        console.error(
          "mesclarSetores (mover colaboradores da função):",
          moverColaboradoresError.message,
        );
        return { error: "Não foi possível mesclar os setores. Tente novamente." };
      }

      const { error: excluirCargoError } = await supabase
        .from("cargos")
        .delete()
        .eq("id", cargoOrigem.id);
      if (excluirCargoError) {
        console.error("mesclarSetores (excluir função mesclada):", excluirCargoError.message);
        return { error: "Não foi possível mesclar os setores. Tente novamente." };
      }
    } else {
      const { error: moverCargoError } = await supabase
        .from("cargos")
        .update({ setor_id: setorDestinoId })
        .eq("id", cargoOrigem.id);
      if (moverCargoError) {
        console.error("mesclarSetores (mover função):", moverCargoError.message);
        return { error: "Não foi possível mesclar os setores. Tente novamente." };
      }
    }
  }

  // ---- 2. Colaboradores: todos passam a apontar pro setor destino ----
  const { error: moverSetorColaboradoresError } = await supabase
    .from("colaboradores")
    .update({ setor_id: setorDestinoId })
    .eq("setor_id", setorOrigemId);
  if (moverSetorColaboradoresError) {
    console.error(
      "mesclarSetores (mover colaboradores):",
      moverSetorColaboradoresError.message,
    );
    return { error: "Não foi possível mesclar os setores. Tente novamente." };
  }

  // ---- 3. EPIs obrigatórios: união (obrigatório num dos dois = obrigatório
  // no destino depois) ----
  const [{ data: epiOrigem }, { data: epiDestino }] = await Promise.all([
    supabase
      .from("setor_epi")
      .select("epi_id, obrigatorio")
      .eq("setor_id", setorOrigemId),
    supabase
      .from("setor_epi")
      .select("epi_id, obrigatorio")
      .eq("setor_id", setorDestinoId),
  ]);

  const obrigatoriedadeFinal = new Map<string, boolean>();
  for (const linha of epiDestino ?? []) {
    obrigatoriedadeFinal.set(linha.epi_id, linha.obrigatorio);
  }
  for (const linha of epiOrigem ?? []) {
    obrigatoriedadeFinal.set(
      linha.epi_id,
      (obrigatoriedadeFinal.get(linha.epi_id) ?? false) || linha.obrigatorio,
    );
  }

  if (obrigatoriedadeFinal.size > 0) {
    const { error: upsertSetorEpiError } = await supabase.from("setor_epi").upsert(
      Array.from(obrigatoriedadeFinal, ([epi_id, obrigatorio]) => ({
        empresa_id: empresaId,
        setor_id: setorDestinoId,
        epi_id,
        obrigatorio,
      })),
      { onConflict: "setor_id,epi_id" },
    );
    if (upsertSetorEpiError) {
      console.error("mesclarSetores (EPIs obrigatórios):", upsertSetorEpiError.message);
      return { error: "Não foi possível mesclar os setores. Tente novamente." };
    }
  }

  const { error: limparSetorEpiOrigemError } = await supabase
    .from("setor_epi")
    .delete()
    .eq("setor_id", setorOrigemId);
  if (limparSetorEpiOrigemError) {
    console.error(
      "mesclarSetores (limpar EPIs obrigatórios da origem):",
      limparSetorEpiOrigemError.message,
    );
    return { error: "Não foi possível mesclar os setores. Tente novamente." };
  }

  // ---- 4. Histórico de Checklist de campo: passa a aparecer no destino ----
  const { error: moverAuditoriasError } = await supabase
    .from("auditorias_nr06")
    .update({ setor_id: setorDestinoId })
    .eq("setor_id", setorOrigemId);
  if (moverAuditoriasError) {
    console.error("mesclarSetores (mover auditorias):", moverAuditoriasError.message);
    return { error: "Não foi possível mesclar os setores. Tente novamente." };
  }

  // ---- 5. Setor origem, já vazio, pode ser excluído ----
  const { data: setorExcluido, error: excluirSetorError } = await supabase
    .from("setores")
    .delete()
    .eq("id", setorOrigemId)
    .select("id")
    .maybeSingle();
  if (excluirSetorError) {
    console.error("mesclarSetores (excluir setor origem):", excluirSetorError.message);
    return { error: "Não foi possível mesclar os setores. Tente novamente." };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: um .delete() que não bate com
  // nenhuma linha retorna error: null mesmo sem apagar nada.
  if (!setorExcluido) {
    console.error(
      "mesclarSetores: delete do setor origem não afetou nenhuma linha para id=",
      setorOrigemId,
    );
    return { error: "Não foi possível mesclar os setores. Tente novamente." };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId,
    tabela: "setores",
    registroId: setorDestinoId,
    acao: "mesclado",
    usuarioId: user.id,
    detalhes: { nome: destino.nome, nomeOrigem: origem.nome },
  });

  revalidatePath("/colaboradores");
  revalidatePath("/auditoria");
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

  // Confirma que o colaborador é da MESMA empresa de quem está desligando,
  // antes de tentar o update — mesma checagem que updateColaborador/
  // reativarColaborador/excluirColaboradorDefinitivamente já fazem, que
  // faltava só aqui (ver checkup de 01/10/2026): sem ela, essa ação ficava
  // dependendo só do RLS pra recusar um id de outra empresa cliente.
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
 * 2) Checamos EXPLICITAMENTE, antes de tentar o delete, se existe qualquer
 *    linha vinculada a este colaborador em `entregas`, `devolucoes`,
 *    `recusas` OU `verificacoes_documento` (todas têm FK RESTRICT pra
 *    `colaboradores`). As três primeiras são o histórico de EPI de fato; a
 *    quarta é a verificação/QR code gerado toda vez que alguém baixa a
 *    "Ficha de Entrega de EPI" dele — mesmo sem nenhuma entrega real, baixar
 *    a ficha uma vez já cria essa linha e, sem essa checagem, o banco recusa
 *    o delete (23503) e o catch genérico antigo atribuía isso a "histórico
 *    de entrega, devolução ou recusa", o que é enganoso quando a causa real
 *    é só a ficha ter sido gerada. Checar as quatro tabelas por contagem (e
 *    listar exatamente qual tem registro) dá um erro preciso em vez de um
 *    chute. O catch de 23503 depois do delete continua existindo como rede
 *    de segurança (ex.: linha criada entre a checagem e o delete), mas na
 *    prática não deve mais ser o caminho normal.
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

  // Confirma que o colaborador é da MESMA empresa de quem está excluindo,
  // antes de tentar o delete — mesma checagem já usada em
  // reativarColaborador/updateEpi, pra não depender só do RLS pra recusar
  // um id de outra empresa cliente.
  const { data: colaborador, error: colaboradorError } = await supabase
    .from("colaboradores")
    .select("status, nome, empresa_id")
    .eq("id", colaboradorId)
    .maybeSingle();

  if (
    colaboradorError ||
    !colaborador ||
    colaborador.empresa_id !== user.empresaId
  ) {
    return { error: "Colaborador não encontrado." };
  }
  if (colaborador.status !== "inativo") {
    return {
      error:
        "Só é possível excluir definitivamente um colaborador que já está desligado.",
    };
  }

  // Checagem proativa (ver comentário da função) — conta, em paralelo, cada
  // tabela que tem FK RESTRICT pra colaboradores.
  const [entregasCheck, devolucoesCheck, recusasCheck, verificacoesCheck] =
    await Promise.all([
      supabase
        .from("entregas")
        .select("id", { count: "exact", head: true })
        .eq("colaborador_id", colaboradorId),
      supabase
        .from("devolucoes")
        .select("id", { count: "exact", head: true })
        .eq("colaborador_id", colaboradorId),
      supabase
        .from("recusas")
        .select("id", { count: "exact", head: true })
        .eq("colaborador_id", colaboradorId),
      supabase
        .from("verificacoes_documento")
        .select("id", { count: "exact", head: true })
        .eq("colaborador_id", colaboradorId),
    ]);

  if (
    entregasCheck.error ||
    devolucoesCheck.error ||
    recusasCheck.error ||
    verificacoesCheck.error
  ) {
    console.error(
      "excluirColaboradorDefinitivamente (checagem de vínculos):",
      entregasCheck.error?.message ??
        devolucoesCheck.error?.message ??
        recusasCheck.error?.message ??
        verificacoesCheck.error?.message,
    );
    return {
      error: "Não foi possível excluir o colaborador. Tente novamente.",
    };
  }

  const countEntregas = entregasCheck.count ?? 0;
  const countDevolucoes = devolucoesCheck.count ?? 0;
  const countRecusas = recusasCheck.count ?? 0;
  const countVerificacoes = verificacoesCheck.count ?? 0;

  const pendencias: string[] = [];
  if (countEntregas > 0) {
    pendencias.push(
      countEntregas === 1 ? "1 entrega" : `${countEntregas} entregas`,
    );
  }
  if (countDevolucoes > 0) {
    pendencias.push(
      countDevolucoes === 1 ? "1 devolução" : `${countDevolucoes} devoluções`,
    );
  }
  if (countRecusas > 0) {
    pendencias.push(
      countRecusas === 1 ? "1 recusa" : `${countRecusas} recusas`,
    );
  }
  if (countVerificacoes > 0) {
    pendencias.push(
      countVerificacoes === 1
        ? "1 verificação de documento (ficha com QR code já gerada)"
        : `${countVerificacoes} verificações de documento (fichas com QR code já geradas)`,
    );
  }

  if (pendencias.length > 0) {
    const lista =
      pendencias.length === 1
        ? pendencias[0]
        : `${pendencias.slice(0, -1).join(", ")} e ${pendencias[pendencias.length - 1]}`;
    const totalItens =
      countEntregas + countDevolucoes + countRecusas + countVerificacoes;
    const vinculadaTexto =
      totalItens === 1 ? "vinculada a ele" : "vinculadas a ele";
    return {
      error: `Não é possível excluir: este colaborador tem ${lista} ${vinculadaTexto}. Pra preservar a conformidade com a NR-06, ele precisa continuar existindo no sistema — mantenha-o desligado.`,
    };
  }

  const { data: excluido, error: deleteError } = await supabase
    .from("colaboradores")
    .delete()
    .eq("id", colaboradorId)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    // Rede de segurança: a checagem acima já deveria ter pego qualquer
    // vínculo, mas se ainda assim o banco recusar por FK (ex.: uma linha
    // criada bem entre a checagem e este delete), cai aqui com uma mensagem
    // genérica em vez de vazar o erro técnico do Postgres.
    if (deleteError.code === "23503") {
      return {
        error:
          "Não é possível excluir: surgiu um novo registro vinculado a este colaborador (entrega, devolução, recusa ou verificação de documento) depois da checagem. Tente excluir novamente.",
      };
    }
    console.error("excluirColaboradorDefinitivamente:", deleteError.message);
    return {
      error: "Não foi possível excluir o colaborador. Tente novamente.",
    };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: um .delete() que não bate com
  // nenhuma linha retorna error: null mesmo sem apagar nada.
  if (!excluido) {
    console.error(
      "excluirColaboradorDefinitivamente: delete não afetou nenhuma linha para colaboradorId=",
      colaboradorId,
    );
    return {
      error: "Não foi possível excluir o colaborador. Tente novamente.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: colaborador.empresa_id,
    tabela: "colaboradores",
    registroId: colaboradorId,
    acao: "excluido",
    usuarioId: user.id,
    detalhes: { nome: colaborador.nome },
  });

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
