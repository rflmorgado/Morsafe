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

export type DefinirLimiteColaboradoresState = { error: string | null };

/**
 * Define (ou remove, com limite = null) o limite de colaboradores ATIVOS
 * incluído no plano contratado pela empresa — usado pro alerta visual na
 * lista de empresas, no detalhe dela e no KPI "Empresas no limite" do
 * Dashboard (ver statusLimiteColaboradores/contarEmpresasNoLimite em
 * lib/data/empresas.ts). Sem limite definido, nenhum alerta é mostrado —
 * por isso o campo em branco (limite null) é uma opção válida, não um erro.
 *
 * limite_colaboradores é uma coluna nova (ver
 * morsafe-add-limite-colaboradores.sql), pendente de aplicação enquanto o
 * acesso ao Supabase continuar bloqueado: até lá, um update aqui falha com
 * o código Postgres 42703 (coluna inexistente), que traduzimos numa
 * mensagem clara em vez de deixar vazar o erro técnico do banco.
 */
export async function definirLimiteColaboradores(
  empresaId: string,
  limite: number | null,
): Promise<DefinirLimiteColaboradoresState> {
  const user = await getCurrentUser();
  if (!user || user.papel !== "super_admin") {
    return { error: SEM_PERMISSAO };
  }

  if (limite !== null && (!Number.isInteger(limite) || limite < 1)) {
    return {
      error:
        "O limite precisa ser um número inteiro maior que zero, ou em branco para remover o limite.",
    };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("empresas")
    .update({ limite_colaboradores: limite })
    .eq("id", empresaId)
    .select("id, nome")
    .maybeSingle();

  if (error) {
    console.error("definirLimiteColaboradores:", error.message);
    // 42703 = Postgres "coluna inexistente" (erro de verdade do banco).
    // PGRST204 = o PostgREST rejeita antes disso, sem nem chegar no banco:
    // não encontra `limite_colaboradores` no SCHEMA CACHE dele — é o caso
    // real aqui enquanto a migração não roda (confirmado em produção; ver
    // mesmo raciocínio do PGRST205 em excluirEmpresaPermanentemente, logo
    // abaixo, pra tabela em vez de coluna). Os dois tratamos igual.
    if (error.code === "42703" || error.code === "PGRST204") {
      return {
        error:
          "Essa função depende de uma coluna nova no banco que ainda não foi criada (acesso ao Supabase está bloqueado pelo chamado de suporte em aberto). Assim que o acesso voltar e a migração pendente rodar, isso passa a funcionar.",
      };
    }
    return { error: "Não foi possível salvar o limite. Tente novamente." };
  }
  if (!data) {
    return { error: "Empresa não encontrada." };
  }

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: data.id,
    tabela: "empresas",
    registroId: data.id,
    acao: "limite_colaboradores_atualizado",
    usuarioId: user.id,
    detalhes: { nome: data.nome, limite },
  });

  revalidatePath(`/empresas/${empresaId}`);
  revalidatePath("/empresas");
  revalidatePath("/dashboard");
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

// Ordem da exclusão DEFINITIVA de uma empresa inteira — mais extensa que
// TABELAS_EM_ORDEM (resetarDadosEmpresa só apaga "dado de EPI de teste",
// mantendo empresa/usuarios/estrutura/log_auditoria). Aqui é tudo: além das
// tabelas de cima, também estações de assinatura, auditorias de NR-06,
// pagamentos, a estrutura organizacional (cargos/setores/unidades —
// colaboradores/epis já estavam na lista de cima) e por fim log_auditoria,
// que nas outras duas exceções da regra 3 do CLAUDE.md é sempre
// preservado, mas aqui não tem como: log_auditoria.usuario referencia
// usuarios(id) com FK restrict (sem "on delete cascade"), e usuarios
// precisa ser apagado antes de empresas (empresas.id <- usuarios.empresa_id
// também é restrict, ver morsafe-schema.sql) — ou seja, log_auditoria TEM
// que sair antes de usuarios, senão o apagamento de usuarios é que trava.
// Ordem pensada de baixo pra cima na árvore de dependências (mesmo
// raciocínio da query de checagem em morsafe-reset-dados-viniplast.sql,
// seção 1c) — tudo que referencia algo é apagado antes do que é
// referenciado.
const TABELAS_EM_ORDEM_EXCLUSAO = [
  "verificacoes_documento",
  "solicitacoes_assinatura",
  "estacoes_assinatura",
  "recusas",
  "devolucoes",
  "entregas",
  "entradas_estoque",
  "auditorias_nr06",
  "log_auditoria",
  "pagamentos_empresa",
  "colaboradores",
  "epis",
  "cargos",
  "setores",
  "unidades",
] as const;

export type ExcluirEmpresaState = {
  error: string | null;
  resultado?: Partial<
    Record<(typeof TABELAS_EM_ORDEM_EXCLUSAO)[number] | "usuarios", number>
  >;
};

/**
 * Exclusão DEFINITIVA de uma empresa cliente inteira — login, estrutura,
 * todo o histórico de EPI, tudo. Terceira exceção, a mais larga, à regra 3
 * do CLAUDE.md (as outras duas são resetarDadosEmpresa, que mantém a
 * empresa e os logins, e excluirEntregaTeste, que apaga uma linha só) —
 * diferente das outras duas, aqui log_auditoria também é apagado (ver
 * comentário em TABELAS_EM_ORDEM_EXCLUSAO acima): não tem como preservar o
 * histórico de uma empresa que deixou de existir.
 *
 * Usada só pra remover de vez um cliente que saiu do MorSafe — nunca pra
 * "limpar dado de teste" (isso é resetarDadosEmpresa) nem pra corrigir um
 * lançamento (isso é excluirEntregaTeste). Duas travas antes de rodar:
 * 1) só com a empresa já desativada antes (mesmo padrão de
 *    excluirUsuarioDefinitivamente em usuarios/actions.ts) — força um passo
 *    deliberado a mais antes do definitivo, e corta o acesso de quem ainda
 *    estivesse logado antes mesmo de começar a apagar;
 * 2) nome exato da empresa digitado como confirmação.
 *
 * Limitação conhecida: como o acesso ao painel do Supabase está bloqueado
 * (chamado de suporte em aberto), não dá pra criar agora uma tabela nova só
 * pra guardar um registro permanente de "empresa X foi excluída, por quem,
 * quando" — o ideal seria uma tabela `empresas_excluidas` sem FK pra
 * `empresas` (só um snapshot), pra sobreviver à própria exclusão. Por ora,
 * isso só fica registrado no log do servidor (Vercel). Revisitar quando o
 * acesso ao Supabase voltar.
 */
export async function excluirEmpresaPermanentemente(
  empresaId: string,
  nomeDigitado: string,
): Promise<ExcluirEmpresaState> {
  const user = await getCurrentUser();
  if (!user || user.papel !== "super_admin") {
    return { error: SEM_PERMISSAO };
  }

  const admin = createAdminClient();

  const { data: empresa, error: empresaError } = await admin
    .from("empresas")
    .select("id, nome, ativo")
    .eq("id", empresaId)
    .maybeSingle();

  if (empresaError || !empresa) {
    console.error(
      "excluirEmpresaPermanentemente (busca empresa):",
      empresaError?.message,
    );
    return { error: "Empresa não encontrada." };
  }

  if (empresa.ativo) {
    return {
      error:
        "Só é possível excluir definitivamente uma empresa que já está desativada. Desative-a primeiro (botão acima).",
    };
  }

  if (nomeDigitado.trim() !== empresa.nome) {
    return { error: `Digite exatamente "${empresa.nome}" para confirmar.` };
  }

  const resultado: ExcluirEmpresaState["resultado"] = {};

  for (const tabela of TABELAS_EM_ORDEM_EXCLUSAO) {
    const { error, count } = await admin
      .from(tabela)
      .delete({ count: "exact" })
      .eq("empresa_id", empresa.id);

    if (error) {
      // PGRST205 = o PostgREST não encontra essa tabela no schema cache —
      // ela ainda não existe de verdade no banco. Acontece hoje com
      // `pagamentos_empresa` especificamente: é uma migração aditiva
      // pendente (ver morsafe-add-pagamentos-empresa.sql), esperando o
      // acesso ao painel do Supabase voltar (chamado de suporte em
      // aberto). Não tem nada pra apagar numa tabela que não existe —
      // conta 0 e segue pro resto, não é motivo pra travar a exclusão.
      if (error.code === "PGRST205") {
        console.warn(
          `excluirEmpresaPermanentemente (${tabela}): tabela ainda não existe no banco (migração pendente) — pulando.`,
        );
        resultado[tabela] = 0;
        continue;
      }

      // 23503 = violação de chave estrangeira: alguma outra tabela (talvez
      // criada direto no Supabase, fora deste repositório) ainda
      // referencia uma linha que estamos tentando apagar aqui.
      console.error(`excluirEmpresaPermanentemente (${tabela}):`, error.message);
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

  // usuarios por último entre os "dados", porque entregas/devolucoes/
  // recusas/entradas_estoque/log_auditoria/verificacoes_documento/
  // solicitacoes_assinatura guardam criado_por/usuario/gerado_por
  // apontando pra cá com FK restrict — todos já apagados no loop acima.
  const { data: usuariosDaEmpresa, error: usuariosBuscaError } = await admin
    .from("usuarios")
    .select("id")
    .eq("empresa_id", empresa.id);

  if (usuariosBuscaError) {
    console.error(
      "excluirEmpresaPermanentemente (buscar usuarios):",
      usuariosBuscaError.message,
    );
    return {
      error: `Não foi possível buscar os usuários da empresa: ${usuariosBuscaError.message}`,
      resultado,
    };
  }

  if (usuariosDaEmpresa && usuariosDaEmpresa.length > 0) {
    const { error: usuariosDeleteError, count } = await admin
      .from("usuarios")
      .delete({ count: "exact" })
      .eq("empresa_id", empresa.id);

    if (usuariosDeleteError) {
      console.error(
        "excluirEmpresaPermanentemente (usuarios):",
        usuariosDeleteError.message,
      );
      return {
        error:
          usuariosDeleteError.code === "23503"
            ? `Não foi possível apagar os usuários: outra tabela ainda referencia algum deles (${usuariosDeleteError.message}). As tabelas já apagadas antes desta continuam apagadas — pode corrigir e rodar de novo.`
            : `Não foi possível apagar os usuários: ${usuariosDeleteError.message}`,
        resultado,
      };
    }
    resultado.usuarios = count ?? 0;

    // Apaga o login de autenticação (Supabase Auth) de cada um — sem isso a
    // pessoa continuaria conseguindo logar, só sem vínculo com empresa
    // nenhuma (um login "fantasma"). Best-effort por usuário: o cadastro em
    // `usuarios` (o que de fato tira o acesso ao sistema) já saiu acima; se
    // o auth falhar aqui, só loga pra investigar depois um possível login
    // órfão — mesmo padrão de excluirUsuarioDefinitivamente.
    for (const u of usuariosDaEmpresa) {
      const { error: authError } = await admin.auth.admin.deleteUser(u.id);
      if (authError) {
        console.error(
          `excluirEmpresaPermanentemente (auth ${u.id}):`,
          authError.message,
        );
      }
    }
  } else {
    resultado.usuarios = 0;
  }

  const { data: empresaApagada, error: empresaDeleteError } = await admin
    .from("empresas")
    .delete()
    .eq("id", empresa.id)
    .select("id")
    .maybeSingle();

  if (empresaDeleteError || !empresaApagada) {
    console.error(
      "excluirEmpresaPermanentemente (empresa):",
      empresaDeleteError?.message,
    );
    return {
      error:
        "Todos os dados e usuários já foram apagados, mas não foi possível apagar o cadastro da empresa em si. Tente de novo — o resto não duplica.",
      resultado,
    };
  }

  // Ver "Limitação conhecida" no comentário da função: isso não vira uma
  // linha durável no banco (log_auditoria da própria empresa já foi
  // apagado acima, de propósito), só fica aqui no log do servidor por
  // enquanto.
  console.log("EMPRESA EXCLUÍDA PERMANENTEMENTE:", {
    empresaId: empresa.id,
    nome: empresa.nome,
    excluidaPor: user.id,
    quando: new Date().toISOString(),
    resultado,
  });

  revalidatePath("/empresas");
  return { error: null, resultado };
}
