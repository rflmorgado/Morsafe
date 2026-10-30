import { createClient } from "@/lib/supabase/server";

export type UnidadeComLogo = {
  id: string;
  nome: string;
  logoUrl: string | null;
};

/**
 * Unidades (filiais do mesmo grupo empresarial — ex: ViniPlast e Vinitrade,
 * sob a mesma empresa cliente do MorSafe) com o respectivo logo. Usado em
 * /empresa pra configurar um logo por unidade quando o grupo tem mais de
 * uma, e na Ficha de EPI (via getColaboradorDetalhe, em colaboradores.ts)
 * pra decidir qual logo mostrar pra cada colaborador — ver colaboradores/[id]
 * /ficha/route.ts.
 *
 * `empresaId` filtra explicitamente, no mesmo padrão de defesa em
 * profundidade usado em listSetoresComCargos (setores.ts) e em
 * listColaboradores (colaboradores.ts) — não depende só do RLS da tabela
 * `unidades` pra isolar as unidades de uma empresa cliente das de outra.
 * `null` (usuário sem empresa) sempre retorna lista vazia, sem consultar
 * o banco.
 */
export async function listUnidades(
  empresaId: string | null,
): Promise<UnidadeComLogo[]> {
  if (!empresaId) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("unidades")
    .select("id, nome, logo_url")
    .eq("empresa_id", empresaId)
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("listUnidades:", error?.message);
    return [];
  }

  return data.map((u) => ({
    id: u.id,
    nome: u.nome,
    logoUrl: u.logo_url,
  }));
}
