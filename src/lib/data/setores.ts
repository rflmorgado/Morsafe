import { createClient } from "@/lib/supabase/server";

export type SetorComCargos = {
  id: string;
  nome: string;
  cargos: { id: string; nome: string }[];
};

/**
 * Setores da empresa atual, cada um com seus cargos — usado para os
 * selects em cascata (Setor → Cargo) do formulário de novo colaborador.
 * O filtro por empresa é garantido pelo RLS.
 */
export async function listSetoresComCargos(): Promise<SetorComCargos[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("setores")
    .select("id, nome, cargos ( id, nome )")
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
