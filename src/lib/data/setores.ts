import { createClient } from "@/lib/supabase/server";

export type SetorComCargos = {
  id: string;
  nome: string;
  cargos: { id: string; nome: string }[];
};

/**
 * Setores da empresa atual, cada um com seus cargos — usado para os
 * selects em cascata (Setor → Cargo) do formulário de novo colaborador.
 *
 * `empresaId` filtra explicitamente — antes dependia só do RLS pra isolar
 * (mesmo raciocínio de listColaboradores/listEpis em colaboradores.ts/
 * epis.ts): `null` quer dizer "sem empresa identificada" e retorna lista
 * vazia direto, sem nem consultar o banco.
 */
export async function listSetoresComCargos(
  empresaId: string | null,
): Promise<SetorComCargos[]> {
  if (!empresaId) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("setores")
    .select("id, nome, cargos ( id, nome )")
    .eq("empresa_id", empresaId)
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("listSetoresComCargos:", error?.message);
    return [];
  }

  return data.map((s) => ({
    id: s.id,
    nome: s.nome,
    cargos: ((s.cargos as unknown as { id: string; nome: string }[]) ?? [])
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome)),
  }));
}
