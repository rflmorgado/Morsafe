import { createAdminClient } from "@/lib/supabase/admin";

export type PapelUsuarioEmpresa = "admin" | "encarregado" | "leitura";

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuarioEmpresa;
  ativo: boolean;
  ultimaAtividade: string | null;
};

export type StatusPresenca = "online" | "ausente" | "offline";

// Limiares da bolinha de presença (verde/laranja/vermelho) em /usuarios:
// dentro de 3 min de atividade = usando agora; até 15 min = ausente
// (logado, mas parado); depois disso, ou sem nunca ter tido atividade
// registrada = offline. Não é "tempo real" (websocket) — a tela relê isso
// a cada carregamento/auto-refresh, o que já é suficiente pra esse uso.
const LIMIAR_ONLINE_MS = 3 * 60_000;
const LIMIAR_AUSENTE_MS = 15 * 60_000;

/**
 * Calcula o status de presença de um usuário a partir da última atividade
 * registrada (atualizada no middleware a cada request autenticado). Um
 * usuário com a conta desativada nunca aparece como online, mesmo que
 * `ultima_atividade` seja recente (não deveria acontecer, já que o
 * middleware barra o acesso, mas não custa ser explícito).
 */
export function statusPresenca(
  ativo: boolean,
  ultimaAtividade: string | null,
): StatusPresenca {
  if (!ativo || !ultimaAtividade) return "offline";
  const decorrido = Date.now() - new Date(ultimaAtividade).getTime();
  if (decorrido <= LIMIAR_ONLINE_MS) return "online";
  if (decorrido <= LIMIAR_AUSENTE_MS) return "ausente";
  return "offline";
}

/**
 * Lista os usuários de UMA empresa (pra tela "Usuários", visível só pro
 * admin da própria empresa). Usa o cliente com service role porque ainda
 * não existe uma política de RLS que deixe um admin ler todas as linhas da
 * própria empresa na tabela `usuarios` (hoje cada usuário só lê a própria
 * linha) — por isso o filtro por `empresaId` abaixo é a única barreira
 * real. Quem chama esta função precisa ter confirmado ANTES que quem está
 * pedindo é de fato admin daquela empresa (ver checagem em
 * src/app/(app)/usuarios/page.tsx e em actions.ts).
 */
export async function listUsuariosDaEmpresa(
  empresaId: string,
): Promise<Usuario[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("usuarios")
    .select("id, nome, papel, ativo, ultima_atividade")
    .eq("empresa_id", empresaId)
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("listUsuariosDaEmpresa:", error?.message);
    return [];
  }

  // E-mail não fica na tabela `usuarios` (só existe em auth.users) — busca
  // à parte pela Admin API e junta pelo id. Empresas pequenas (poucos
  // usuários cada), então N chamadas aqui é aceitável.
  const comEmail = await Promise.all(
    data.map(async (u) => {
      const { data: authUser } = await admin.auth.admin.getUserById(u.id);
      return {
        id: u.id,
        nome: u.nome,
        email: authUser?.user?.email ?? "—",
        papel: u.papel as PapelUsuarioEmpresa,
        ativo: u.ativo,
        ultimaAtividade: u.ultima_atividade,
      };
    }),
  );

  return comEmail;
}

/**
 * Busca um único usuário da empresa (pra tela de Histórico) — mesmo
 * cuidado de listUsuariosDaEmpresa: confere `empresaId` como única barreira
 * real, já que o cliente admin ignora RLS. Retorna null se o usuário não
 * existir ou pertencer a outra empresa.
 */
export async function getUsuarioDaEmpresa(
  usuarioId: string,
  empresaId: string,
): Promise<Usuario | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("usuarios")
    .select("id, nome, papel, ativo, empresa_id, ultima_atividade")
    .eq("id", usuarioId)
    .maybeSingle();

  if (error || !data || data.empresa_id !== empresaId) {
    return null;
  }

  const { data: authUser } = await admin.auth.admin.getUserById(data.id);

  return {
    id: data.id,
    nome: data.nome,
    email: authUser?.user?.email ?? "—",
    papel: data.papel as PapelUsuarioEmpresa,
    ativo: data.ativo,
    ultimaAtividade: data.ultima_atividade,
  };
}
