"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/data/current-user";

// Não exportado de propósito: um arquivo "use server" só pode exportar
// funções async (restrição do Next.js) — o formulário cliente usa a mesma
// string, digitada diretamente (mesmo padrão de pequena duplicação já usado
// entre os botões de importação deste projeto).
const CONFIRMACAO_ESPERADA = "RESETAR VINIPLAST";

// Ordem pensada pra respeitar as dependências do banco — igual ao script
// morsafe-reset-dados-viniplast.sql (que faria o mesmo via SQL direto, se o
// painel do Supabase estivesse acessível): tudo que referencia colaboradores
// ou epis precisa ser apagado antes deles. `estoque` não entra na lista
// porque é apagado em cascata junto com `epis` (estoque.epi_id -> epis.id
// on delete cascade).
const TABELAS_EM_ORDEM = [
  "verificacoes_documento",
  "solicitacoes_assinatura",
  "recusas",
  "devolucoes",
  "entregas",
  "entradas_estoque",
  "colaboradores",
  "epis",
] as const;

export type ResetEmpresaState = {
  error: string | null;
  resultado?: Partial<Record<(typeof TABELAS_EM_ORDEM)[number], number>>;
};

/**
 * FERRAMENTA TEMPORÁRIA DE USO ÚNICO — ver comentário no topo de page.tsx.
 *
 * Isto é uma exceção deliberada, explicitamente autorizada pelo dono do
 * MorSafe, à regra 3 do CLAUDE.md (nenhum caminho de código deve dar
 * .delete() em entregas/devolucoes/recusas/verificacoes_documento): o
 * objetivo aqui é justamente apagar dados de TESTE dessas tabelas pra
 * ViniPlast, porque o painel do Supabase (e portanto o SQL Editor, o
 * caminho normal pra isso) está inacessível desde 28/09 — chamado aberto
 * com o suporte do Supabase, ainda sem resposta. Usa o cliente com service
 * role (mesmo de usuarios/actions.ts) porque ele não depende do painel.
 *
 * log_auditoria é mantido de propósito (decisão do dono do MorSafe) — as
 * ações registradas ficam órfãs (apontando pra registros que não existem
 * mais), mas isso não quebra nada: a tela de auditoria só lê e formata, não
 * faz join nenhum com as tabelas de origem.
 *
 * Quando o acesso ao Supabase voltar e este reset já tiver sido feito,
 * apague esta pasta inteira (ferramenta-reset-viniplast) do repositório —
 * nunca deixar isso como um botão permanente, nem que só o super_admin veja.
 */
export async function resetarDadosViniplast(
  confirmacao: string,
): Promise<ResetEmpresaState> {
  const user = await getCurrentUser();
  if (!user || user.papel !== "super_admin") {
    return { error: "Acesso restrito ao super_admin." };
  }

  if (confirmacao.trim() !== CONFIRMACAO_ESPERADA) {
    return {
      error: `Digite exatamente "${CONFIRMACAO_ESPERADA}" para confirmar.`,
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("resetarDadosViniplast (admin client):", e);
    return {
      error:
        "Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY ausente).",
    };
  }

  const { data: empresa, error: empresaError } = await admin
    .from("empresas")
    .select("id, nome")
    .ilike("nome", "%viniplast%")
    .maybeSingle();

  if (empresaError || !empresa) {
    console.error("resetarDadosViniplast (busca empresa):", empresaError?.message);
    return { error: "Não foi possível encontrar a empresa ViniPlast." };
  }

  const resultado: ResetEmpresaState["resultado"] = {};

  for (const tabela of TABELAS_EM_ORDEM) {
    const { error, count } = await admin
      .from(tabela)
      .delete({ count: "exact" })
      .eq("empresa_id", empresa.id);

    if (error) {
      // 23503 = violação de chave estrangeira: alguma outra tabela (talvez
      // uma criada direto no Supabase, fora deste repositório — já
      // aconteceu antes, ver morsafe-fix-checkup-estoque.sql) ainda
      // referencia uma linha que estamos tentando apagar aqui.
      console.error(`resetarDadosViniplast (${tabela}):`, error.message);
      return {
        error:
          error.code === "23503"
            ? `Não foi possível apagar "${tabela}": outra tabela ainda referencia esses registros (${error.message}). As tabelas já apagadas antes desta continuam apagadas — pode corrigir e rodar de novo.`
            : `Não foi possível apagar "${tabela}": ${error.message}`,
        resultado,
      };
    }

    resultado[tabela] = count ?? 0;
  }

  return { error: null, resultado };
}
