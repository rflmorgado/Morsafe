"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

// Papéis que um admin de empresa pode atribuir a um colega. "super_admin"
// fica de fora de propósito — esse continua exclusivo do cadastro de
// empresa nova em /setup-empresa, nunca atribuível por aqui.
const PAPEIS_CRIAVEIS = ["admin", "encarregado", "leitura"] as const;
type PapelCriavel = (typeof PAPEIS_CRIAVEIS)[number];

function isPapelCriavel(value: string): value is PapelCriavel {
  return (PAPEIS_CRIAVEIS as readonly string[]).includes(value);
}

export type CriarUsuarioState = { error: string | null; success?: boolean };

/**
 * Cria um novo login pra um colega da MESMA empresa de quem está criando.
 * Usa o cliente com service role (auth.admin.createUser) em vez do signUp
 * comum usado em /setup-empresa — assim cria o login sem derrubar a sessão
 * de quem está criando. Em /setup-empresa isso é aceitável (ação rara, só
 * do super_admin), mas aqui seria toda vez que um admin cadastra um colega,
 * o que aconteceria com frequência — por isso vale a pena evitar.
 */
export async function criarUsuario(
  _prevState: CriarUsuarioState,
  formData: FormData,
): Promise<CriarUsuarioState> {
  const requester = await getCurrentUser();
  if (!requester?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(requester.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const papel = String(formData.get("papel") ?? "");

  if (!nome || !email || !senha || !papel) {
    return { error: "Preencha nome, e-mail, senha e papel." };
  }
  if (senha.length < 6) {
    return { error: "A senha deve ter ao menos 6 caracteres." };
  }
  if (!isPapelCriavel(papel)) {
    return { error: "Papel inválido." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("criarUsuario (admin client):", e);
    return {
      error:
        "Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY ausente). Avise o suporte do MorSafe.",
    };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (createError || !created.user) {
    const jaExiste =
      createError?.code === "email_exists" ||
      /already.*registered/i.test(createError?.message ?? "");
    return {
      error: jaExiste
        ? "Já existe um usuário com esse e-mail."
        : `Não foi possível criar o usuário. Detalhe: ${createError?.message ?? "erro desconhecido"}`,
    };
  }

  const { error: usuarioError } = await admin.from("usuarios").insert({
    id: created.user.id,
    empresa_id: requester.empresaId,
    nome,
    papel,
  });

  if (usuarioError) {
    // Login de autenticação ficou órfão (sem vínculo com empresa) —
    // remove pra não deixar lixo, já que a criação como um todo falhou.
    await admin.auth.admin.deleteUser(created.user.id);
    console.error("criarUsuario (insert usuario):", usuarioError.message);
    return {
      error: "Não foi possível vincular o usuário à empresa. Tente novamente.",
    };
  }

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: requester.empresaId,
    tabela: "usuarios",
    registroId: created.user.id,
    acao: "criado",
    usuarioId: requester.id,
    detalhes: { nome, papel },
  });

  revalidatePath("/usuarios");
  return { error: null, success: true };
}

export type AtualizarPapelUsuarioState = { error: string | null; success?: boolean };

// Cada action abaixo confere, com uma consulta própria, que o usuário-alvo
// pertence à MESMA empresa de quem está editando antes de aplicar qualquer
// mudança — trava real, já que o cliente admin ignora RLS por completo. A
// mesma consulta já aproveita pra trazer nome (e, quando relevante, o papel
// atual) usados no registro do histórico de ações.

export async function atualizarPapelUsuario(
  usuarioId: string,
  novoPapel: string,
): Promise<AtualizarPapelUsuarioState> {
  const requester = await getCurrentUser();
  if (!requester?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(requester.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  if (usuarioId === requester.id) {
    return { error: "Você não pode alterar o próprio papel por aqui." };
  }
  if (!isPapelCriavel(novoPapel)) {
    return { error: "Papel inválido." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("atualizarPapelUsuario (admin client):", e);
    return {
      error:
        "Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY ausente). Avise o suporte do MorSafe.",
    };
  }

  const { data: alvo } = await admin
    .from("usuarios")
    .select("empresa_id, nome, papel")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!alvo || alvo.empresa_id !== requester.empresaId) {
    return { error: "Usuário não encontrado." };
  }

  const { data, error } = await admin
    .from("usuarios")
    .update({ papel: novoPapel })
    .eq("id", usuarioId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("atualizarPapelUsuario:", error.message);
    return { error: "Não foi possível atualizar o papel. Tente novamente." };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: sem ela, um .update() que não
  // bate com nenhuma linha registraria "papel_alterado" no histórico e diria
  // sucesso pro admin mesmo com o papel do usuário continuando o mesmo —
  // grave numa ação que decide o nível de acesso de alguém no sistema.
  if (!data) {
    console.error(
      "atualizarPapelUsuario: update não afetou nenhuma linha para usuarioId=",
      usuarioId,
    );
    return {
      error:
        "Não foi possível confirmar a alteração do papel. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: requester.empresaId,
    tabela: "usuarios",
    registroId: usuarioId,
    acao: "papel_alterado",
    usuarioId: requester.id,
    detalhes: { nome: alvo.nome, de: alvo.papel, para: novoPapel },
  });

  revalidatePath("/usuarios");
  return { error: null, success: true };
}

export type DesativarUsuarioState = { error: string | null; success?: boolean };

/**
 * Desativação = soft delete (ativo -> false): bloqueia o login dessa
 * pessoa (checado no middleware) sem apagar nada do histórico do que ela
 * já registrou no sistema. Não pode ser usada na própria conta — evita se
 * trancar fora sem querer.
 */
export async function desativarUsuario(
  usuarioId: string,
): Promise<DesativarUsuarioState> {
  const requester = await getCurrentUser();
  if (!requester?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(requester.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  if (usuarioId === requester.id) {
    return { error: "Você não pode desativar o próprio acesso por aqui." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("desativarUsuario (admin client):", e);
    return {
      error:
        "Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY ausente). Avise o suporte do MorSafe.",
    };
  }

  const { data: alvo } = await admin
    .from("usuarios")
    .select("empresa_id, nome")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!alvo || alvo.empresa_id !== requester.empresaId) {
    return { error: "Usuário não encontrado." };
  }

  const { data, error } = await admin
    .from("usuarios")
    .update({ ativo: false })
    .eq("id", usuarioId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("desativarUsuario:", error.message);
    return { error: "Não foi possível desativar o usuário. Tente novamente." };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: sem ela, um .update() que não
  // bate com nenhuma linha registraria "desativado" no histórico e diria
  // sucesso pro admin mesmo com o login da pessoa continuando ativo — grave
  // justamente numa ação de revogar acesso (ex: desligamento).
  if (!data) {
    console.error(
      "desativarUsuario: update não afetou nenhuma linha para usuarioId=",
      usuarioId,
    );
    return {
      error:
        "Não foi possível confirmar a desativação. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: requester.empresaId,
    tabela: "usuarios",
    registroId: usuarioId,
    acao: "desativado",
    usuarioId: requester.id,
    detalhes: { nome: alvo.nome },
  });

  revalidatePath("/usuarios");
  return { error: null, success: true };
}

export type ReativarUsuarioState = { error: string | null; success?: boolean };

export async function reativarUsuario(
  usuarioId: string,
): Promise<ReativarUsuarioState> {
  const requester = await getCurrentUser();
  if (!requester?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(requester.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("reativarUsuario (admin client):", e);
    return {
      error:
        "Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY ausente). Avise o suporte do MorSafe.",
    };
  }

  const { data: alvo } = await admin
    .from("usuarios")
    .select("empresa_id, nome")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!alvo || alvo.empresa_id !== requester.empresaId) {
    return { error: "Usuário não encontrado." };
  }

  const { data, error } = await admin
    .from("usuarios")
    .update({ ativo: true })
    .eq("id", usuarioId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("reativarUsuario:", error.message);
    return { error: "Não foi possível reativar o usuário. Tente novamente." };
  }
  // Mesma checagem da regra 1 do CLAUDE.md: sem ela, um .update() que não
  // bate com nenhuma linha registraria "reativado" no histórico e diria
  // sucesso pro admin mesmo com o login da pessoa continuando desativado.
  if (!data) {
    console.error(
      "reativarUsuario: update não afetou nenhuma linha para usuarioId=",
      usuarioId,
    );
    return {
      error:
        "Não foi possível confirmar a reativação. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: requester.empresaId,
    tabela: "usuarios",
    registroId: usuarioId,
    acao: "reativado",
    usuarioId: requester.id,
    detalhes: { nome: alvo.nome },
  });

  revalidatePath("/usuarios");
  return { error: null, success: true };
}

export type ExcluirUsuarioState = { error: string | null; success?: boolean };

/**
 * Exclusão DEFINITIVA de um usuário (login) — diferente de desativar, que é
 * soft delete. Não é o caminho pra desligamento normal (esse é o
 * "Desativar", que já bloqueia o login na hora sem apagar nada); serve mais
 * pra limpar uma conta criada por engano ou de teste.
 *
 * Duas travas antes de excluir:
 * 1) Só permitida em cima de um usuário já desativado (a interface só
 *    oferece essa opção depois da desativação, mesmo padrão do
 *    colaborador/EPI).
 * 2) entregas, devoluções, recusas e entradas de estoque guardam
 *    `criado_por` apontando pro usuário que registrou cada uma — apagar um
 *    usuário com qualquer histórico assim quebraria esse rastro. O próprio
 *    banco recusa via FK RESTRICT (código Postgres 23503); aqui só
 *    traduzimos isso numa mensagem clara. Na prática, qualquer usuário que
 *    já usou o sistema fica bloqueado — essa ação serve mesmo é pra quem
 *    nunca chegou a registrar nada.
 *
 * Se a linha em `usuarios` sai sem problema, o login de autenticação
 * também é removido (auth.admin.deleteUser) — sem isso a pessoa continuaria
 * existindo no Supabase Auth, só sem vínculo com a empresa.
 */
export async function excluirUsuarioDefinitivamente(
  usuarioId: string,
): Promise<ExcluirUsuarioState> {
  const requester = await getCurrentUser();
  if (!requester?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(requester.papel, "admin")) {
    return { error: SEM_PERMISSAO };
  }

  if (usuarioId === requester.id) {
    return { error: "Você não pode excluir o próprio acesso por aqui." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("excluirUsuarioDefinitivamente (admin client):", e);
    return {
      error:
        "Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY ausente). Avise o suporte do MorSafe.",
    };
  }

  const { data: usuario, error: usuarioError } = await admin
    .from("usuarios")
    .select("empresa_id, ativo, nome")
    .eq("id", usuarioId)
    .maybeSingle();

  if (
    usuarioError ||
    !usuario ||
    usuario.empresa_id !== requester.empresaId
  ) {
    return { error: "Usuário não encontrado." };
  }
  if (usuario.ativo) {
    return {
      error:
        "Só é possível excluir definitivamente um usuário que já está desativado.",
    };
  }

  const { data: excluido, error: deleteError } = await admin
    .from("usuarios")
    .delete()
    .eq("id", usuarioId)
    .select("id");

  if (deleteError) {
    if (deleteError.code === "23503") {
      return {
        error:
          "Não é possível excluir: este usuário já tem entregas, devoluções, recusas, entradas de estoque ou ações registradas no histórico em nome dele. Pra preservar o histórico, mantenha-o desativado.",
      };
    }
    console.error("excluirUsuarioDefinitivamente:", deleteError.message);
    return { error: "Não foi possível excluir o usuário. Tente novamente." };
  }
  // Mesma checagem da regra 1 do CLAUDE.md (ver as outras actions deste
  // arquivo): um .delete() que não bate com nenhuma linha retorna
  // error: null mesmo sem apagar nada — faltava só aqui (ver checkup de
  // 01/10/2026). Sem este check, um clique duplo ou uma corrida com outra
  // aba excluiria só o login de autenticação logo abaixo, deixando o
  // cadastro em `usuarios` pra trás e o histórico de ações registrando
  // "excluído" sem o registro ter de fato saído do banco.
  if (!excluido || excluido.length === 0) {
    console.error(
      "excluirUsuarioDefinitivamente: delete não afetou nenhuma linha para usuarioId=",
      usuarioId,
    );
    return { error: "Não foi possível excluir o usuário. Tente novamente." };
  }

  const { error: authDeleteError } =
    await admin.auth.admin.deleteUser(usuarioId);
  if (authDeleteError) {
    // O cadastro em `usuarios` já foi removido (é o que importa pra sair
    // da lista e das permissões); loga só pra investigar depois se sobrou
    // um login órfão no Supabase Auth.
    console.error(
      "excluirUsuarioDefinitivamente (auth):",
      authDeleteError.message,
    );
  }

  // usuarioId aqui é quem foi EXCLUÍDO, não o autor — a linha em `usuarios`
  // já não existe mais, e log_auditoria.usuario tem FK pra usuarios(id), então
  // o autor (requester, que continua existindo) é quem entra nessa coluna.
  await registrarLogAuditoria({
    supabase: admin,
    empresaId: requester.empresaId,
    tabela: "usuarios",
    registroId: usuarioId,
    acao: "excluido",
    usuarioId: requester.id,
    detalhes: { nome: usuario.nome },
  });

  revalidatePath("/usuarios");
  return { error: null, success: true };
}
