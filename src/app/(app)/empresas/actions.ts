"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/data/current-user";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

export type AlternarAtivoState = { error: string | null };

/**
 * Ativa/desativa o acesso de uma empresa cliente ao MorSafe — enforçado de
 * verdade no middleware (ver src/lib/supabase/middleware.ts), não só um
 * rótulo na tela: com a empresa desativada, qualquer login de um usuário
 * dela é encerrado na hora.
 */
export async function alternarAtivoEmpresa(
  empresaId: string,
  novoValor: boolean,
): Promise<AlternarAtivoState> {
  const user = await getCurrentUser();
  if (!user || user.papel !== "super_admin") {
    return { error: SEM_PERMISSAO };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("empresas")
    .update({ ativo: novoValor })
    .eq("id", empresaId)
    .select("id, nome")
    .maybeSingle();

  if (error) {
    console.error("alternarAtivoEmpresa:", error.message);
    return { error: "Não foi possível atualizar a empresa." };
  }
  if (!data) {
    return { error: "Empresa não encontrada." };
  }

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: data.id,
    tabela: "empresas",
    registroId: data.id,
    acao: novoValor ? "reativado" : "desativado",
    usuarioId: user.id,
    detalhes: { nome: data.nome },
  });

  revalidatePath(`/empresas/${empresaId}`);
  revalidatePath("/empresas");
  return { error: null };
}

// Ordem pensada pra respeitar as dependências do banco — tudo que
// referencia colaboradores ou epis precisa ser apagado antes deles.
// `estoque` não entra na lista porque é apagado em cascata junto com
// `epis` (estoque.epi_id -> epis.id on delete cascade). Mesma lista usada
// na extinta ferramenta-reset-viniplast (agora substituída por esta
// versão permanente, por empresa).
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
 * Reset de dados de TESTE de uma empresa cliente — exceção deliberada e
 * documentada à regra 3 do CLAUDE.md (ver comentário lá). Só super_admin,
 * e só com o nome exato da empresa digitado como confirmação (evita clique
 * errado na empresa errada, já que esta tela lista várias). Usa o cliente
 * com service role porque ignora RLS — e porque pode ser necessário mesmo
 * sem o painel do Supabase acessível (ver motivo original disto em
 * morsafe-reset-dados-viniplast.sql).
 *
 * log_auditoria NUNCA é apagado — GRAVA uma linha nova (ação
 * "dados_resetados") contando que o reset aconteceu, quando e quem fez.
 */
export async function resetarDadosEmpresa(
  empresaId: string,
  nomeDigitado: string,
): Promise<ResetEmpresaState> {
  const user = await getCurrentUser();
  if (!user || user.papel !== "super_admin") {
    return { error: SEM_PERMISSAO };
  }

  const admin = createAdminClient();

  const { data: empresa, error: empresaError } = await admin
    .from("empresas")
    .select("id, nome")
    .eq("id", empresaId)
    .maybeSingle();

  if (empresaError || !empresa) {
    console.error("resetarDadosEmpresa (busca empresa):", empresaError?.message);
    return { error: "Empresa não encontrada." };
  }

  if (nomeDigitado.trim() !== empresa.nome) {
    return { error: `Digite exatamente "${empresa.nome}" para confirmar.` };
  }

  const resultado: ResetEmpresaState["resultado"] = {};

  for (const tabela of TABELAS_EM_ORDEM) {
    const { error, count } = await admin
      .from(tabela)
      .delete({ count: "exact" })
      .eq("empresa_id", empresa.id);

    if (error) {
      // 23503 = violação de chave estrangeira: alguma outra tabela (talvez
      // criada direto no Supabase, fora deste repositório) ainda
      // referencia uma linha que estamos tentando apagar aqui.
      console.error(`resetarDadosEmpresa (${tabela}):`, error.message);
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

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: empresa.id,
    tabela: "empresas",
    registroId: empresa.id,
    acao: "dados_resetados",
    usuarioId: user.id,
    detalhes: resultado,
  });

  revalidatePath(`/empresas/${empresaId}`);
  revalidatePath("/empresas");

  return { error: null, resultado };
}
