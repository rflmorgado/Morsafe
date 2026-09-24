import { createClient } from "@/lib/supabase/server";

export type EstacaoAssinatura = {
  id: string;
  nome: string;
  ativo: boolean;
  pareada: boolean;
  criadoEm: string;
  pareadoEm: string | null;
  ultimoPing: string | null;
};

/**
 * Todas as estações de assinatura da empresa (pareadas ou não, ativas ou
 * não) — usada na tela de administração (src/app/(app)/estacoes). Nunca
 * expõe o token nem o código de pareamento pra fora deste arquivo: o token
 * é o "segredo" do aparelho, só a Server Action que gera o QR precisa dele.
 */
export async function listEstacoesAssinatura(): Promise<EstacaoAssinatura[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("estacoes_assinatura")
    .select("id, nome, token, ativo, criado_em, pareado_em, ultimo_ping")
    .order("criado_em", { ascending: false });

  if (error || !data) {
    console.error("listEstacoesAssinatura:", error?.message);
    return [];
  }

  return data.map((e) => ({
    id: e.id,
    nome: e.nome,
    ativo: e.ativo,
    pareada: e.token !== null,
    criadoEm: e.criado_em,
    pareadoEm: e.pareado_em,
    ultimoPing: e.ultimo_ping,
  }));
}

/**
 * Estações prontas pra uso (ativas E já pareadas com um aparelho) — é o
 * que alimenta o seletor "Coletar assinatura na estação..." no formulário
 * de Registrar entrega. Uma estação criada mas ainda não pareada, ou
 * desativada pelo admin, não aparece pra quem está registrando a entrega.
 */
export async function listEstacoesAtivas(): Promise<
  { id: string; nome: string }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("estacoes_assinatura")
    .select("id, nome, token, ativo")
    .eq("ativo", true)
    .not("token", "is", null)
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("listEstacoesAtivas:", error?.message);
    return [];
  }

  return data.map((e) => ({ id: e.id, nome: e.nome }));
}
