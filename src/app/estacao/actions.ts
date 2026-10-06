"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { gerarTokenEstacao } from "@/lib/estacao-assinatura/tokens";
import type { TipoSolicitacaoAssinatura } from "@/types/database";

/**
 * Todas as actions deste arquivo rodam SEM usuário logado — quem chama é o
 * navegador do tablet/celular pareado, autenticado só pelo token que ele
 * guarda no localStorage (ver src/app/estacao/page.tsx), nunca por uma
 * sessão do Supabase Auth. Por isso usam o cliente com service role
 * (ignora RLS) e cada função abaixo faz a própria checagem manual de
 * "esse token é de uma estação ativa" antes de tocar em qualquer linha —
 * essa checagem É a barreira de segurança aqui, não o RLS.
 */

export type ExchangeCodigoResult =
  | { error: string; token?: undefined }
  | { error: null; token: string; estacaoId: string; estacaoNome: string };

/**
 * Troca um código de pareamento (mostrado como QR na tela de admin, válido
 * por poucos minutos) por um token permanente — chamado uma única vez, na
 * hora de configurar o aparelho.
 */
export async function exchangeCodigoPareamento(
  codigo: string,
): Promise<ExchangeCodigoResult> {
  const codigoLimpo = codigo.trim().toUpperCase();
  if (!codigoLimpo) {
    return { error: "Código inválido." };
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (e) {
    console.error("exchangeCodigoPareamento (admin client):", e);
    return {
      error: "Configuração do servidor incompleta. Avise o suporte do MorSafe.",
    };
  }

  const { data: estacao, error: buscaError } = await supabase
    .from("estacoes_assinatura")
    .select("id, nome, ativo, codigo_expira_em")
    .eq("codigo_pareamento", codigoLimpo)
    .maybeSingle();

  if (buscaError || !estacao) {
    return { error: "Código não encontrado. Peça um novo QR ao administrador." };
  }
  if (!estacao.ativo) {
    return { error: "Esta estação foi desativada pelo administrador." };
  }
  if (
    !estacao.codigo_expira_em ||
    new Date(estacao.codigo_expira_em).getTime() < Date.now()
  ) {
    return {
      error: "Este código expirou. Peça um novo QR ao administrador.",
    };
  }

  const token = gerarTokenEstacao();

  const { error: updateError } = await supabase
    .from("estacoes_assinatura")
    .update({
      token,
      codigo_pareamento: null,
      codigo_expira_em: null,
      pareado_em: new Date().toISOString(),
      ultimo_ping: new Date().toISOString(),
    })
    .eq("id", estacao.id);

  if (updateError) {
    console.error("exchangeCodigoPareamento:", updateError.message);
    return { error: "Não foi possível parear o aparelho. Tente novamente." };
  }

  return {
    error: null,
    token,
    estacaoId: estacao.id,
    estacaoNome: estacao.nome,
  };
}

export type SolicitacaoPendente = {
  id: string;
  colaboradorNome: string;
  epiNome: string;
  criadoEm: string;
  // Decide só o texto mostrado na tela de assinatura (ver estacao/page.tsx)
  // — "Confirmação de recebimento" (entrega) vs "Confirmação de devolução".
  tipo: TipoSolicitacaoAssinatura;
};

export type BuscarSolicitacaoResult =
  | { error: string; estacaoNome?: undefined; solicitacao?: undefined }
  | {
      error: null;
      estacaoNome: string;
      solicitacao: SolicitacaoPendente | null;
    };

/**
 * Consultado pela estação a cada ~2s (ver src/app/estacao/page.tsx) — além
 * de devolver o próximo pedido pendente (o mais antigo primeiro, se houver
 * mais de um na fila), atualiza `ultimo_ping` pra alimentar a bolinha de
 * status na tela de administração.
 */
export async function buscarSolicitacaoPendente(
  token: string,
): Promise<BuscarSolicitacaoResult> {
  if (!token) return { error: "Aparelho não pareado." };

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (e) {
    console.error("buscarSolicitacaoPendente (admin client):", e);
    return {
      error: "Configuração do servidor incompleta. Avise o suporte do MorSafe.",
    };
  }

  const { data: estacao, error: estacaoError } = await supabase
    .from("estacoes_assinatura")
    .select("id, nome, ativo")
    .eq("token", token)
    .maybeSingle();

  if (estacaoError || !estacao || !estacao.ativo) {
    return { error: "Aparelho não reconhecido ou desativado." };
  }

  await supabase
    .from("estacoes_assinatura")
    .update({ ultimo_ping: new Date().toISOString() })
    .eq("id", estacao.id);

  const { data: pendente } = await supabase
    .from("solicitacoes_assinatura")
    .select("id, colaborador_nome, epi_nome, criado_em, tipo")
    .eq("estacao_id", estacao.id)
    .eq("status", "aguardando")
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    error: null,
    estacaoNome: estacao.nome,
    solicitacao: pendente
      ? {
          id: pendente.id,
          colaboradorNome: pendente.colaborador_nome,
          epiNome: pendente.epi_nome,
          criadoEm: pendente.criado_em,
          // Pedidos criados antes desta coluna existir não têm valor —
          // trata como "entrega" (era o único tipo possível até agora),
          // nunca deixa a tela sem saber o que mostrar.
          tipo: pendente.tipo ?? "entrega",
        }
      : null,
  };
}

/**
 * Logo da empresa dona desta estação — buscado UMA VEZ (ver useEffect em
 * page.tsx), nunca a cada poll de buscarSolicitacaoPendente() (a cada 2s):
 * o logo é um PNG em data URL, com dezenas de KB (ver comentário em
 * lib/data/empresa.ts), e reenviar isso a cada 2 segundos pra sempre
 * desperdiçaria dados do aparelho à toa. `null` cobre tanto "empresa sem
 * logo cadastrado" quanto qualquer falha — funcionalidade acessória nunca
 * pode travar a tela principal da estação (CLAUDE.md, regra 4).
 */
export async function buscarLogoEstacao(token: string): Promise<string | null> {
  if (!token) return null;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (e) {
    console.error("buscarLogoEstacao (admin client):", e);
    return null;
  }

  const { data: estacao } = await supabase
    .from("estacoes_assinatura")
    .select("empresa_id")
    .eq("token", token)
    .maybeSingle();

  if (!estacao) return null;

  const { data: empresa } = await supabase
    .from("empresas")
    .select("logo_url")
    .eq("id", estacao.empresa_id)
    .maybeSingle();

  return empresa?.logo_url ?? null;
}

export type ResponderSolicitacaoState = {
  error: string | null;
  // Discriminam o motivo do erro pra quem chama (ver estacao/page.tsx)
  // conseguir decidir se vale a pena insistir no MESMO pedido ou se é hora
  // de desistir dele e voltar a aguardar o próximo — sem isso a estação
  // ficava travada pra sempre numa tela de assinatura de um pedido que já
  // não existe mais (ver Item 5 da revisão).
  orfao?: boolean;
  aparelhoInvalido?: boolean;
};

/**
 * Chamado pela estação depois que o colaborador assina na tela — só aceita
 * responder um pedido que pertence à PRÓPRIA estação (pelo token) e que
 * ainda está "aguardando", pra um token não conseguir responder por
 * pedidos de outra estação nem reenviar assinatura de um pedido já
 * fechado.
 */
export async function responderSolicitacaoAssinatura(
  token: string,
  solicitacaoId: string,
  assinaturaUrl: string,
): Promise<ResponderSolicitacaoState> {
  if (!token) return { error: "Aparelho não pareado." };
  if (!assinaturaUrl) return { error: "Assinatura vazia." };

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (e) {
    console.error("responderSolicitacaoAssinatura (admin client):", e);
    return {
      error: "Configuração do servidor incompleta. Avise o suporte do MorSafe.",
    };
  }

  const { data: estacao, error: estacaoError } = await supabase
    .from("estacoes_assinatura")
    .select("id, ativo")
    .eq("token", token)
    .maybeSingle();

  if (estacaoError || !estacao || !estacao.ativo) {
    return {
      error: "Aparelho não reconhecido ou desativado.",
      aparelhoInvalido: true,
    };
  }

  const { data, error } = await supabase
    .from("solicitacoes_assinatura")
    .update({
      status: "assinado",
      assinatura_url: assinaturaUrl,
      respondido_em: new Date().toISOString(),
    })
    .eq("id", solicitacaoId)
    .eq("estacao_id", estacao.id)
    .eq("status", "aguardando")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("responderSolicitacaoAssinatura:", error.message);
    return { error: "Não foi possível enviar a assinatura. Tente novamente." };
  }

  // Um .update() que não bate com nenhuma linha retorna error: null mesmo
  // sem alterar nada (ver CLAUDE.md, regra 1) — e isso acontece de verdade
  // aqui sempre que o pedido foi cancelado (ou já respondido) entre a
  // estação carregar a tela de assinatura e o colaborador confirmar. Sem
  // este check, a estação mostraria "✓ Assinatura enviada" pro colaborador
  // com a assinatura nunca salva em lugar nenhum.
  if (!data) {
    return {
      error:
        "Este pedido não está mais aguardando assinatura (pode ter sido cancelado). Peça pro responsável registrar a entrega de novo.",
      orfao: true,
    };
  }

  return { error: null };
}
