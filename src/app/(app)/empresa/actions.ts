"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";
import { atualizarClienteAsaas } from "@/lib/asaas/client";

export type AtualizarLogoState = { error: string | null };

/**
 * Salva (ou remove, passando null) o logo da empresa exibido no topo da
 * Ficha de EPI. A tabela `empresas` não tem RLS no banco (só a criação em
 * /setup-empresa é restrita, ver comentário lá) — então a trava de verdade
 * aqui é dupla: papel mínimo "admin" checado no servidor, e o id da empresa
 * sempre vem do usuário autenticado (getCurrentUser), nunca de um campo do
 * formulário que alguém poderia adulterar pra editar o logo de outra
 * empresa cliente.
 */
export async function atualizarLogoEmpresa(
  logoDataUrl: string | null,
): Promise<AtualizarLogoState> {
  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: "Seu perfil de acesso não permite essa ação." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .update({ logo_url: logoDataUrl })
    .eq("id", user.empresaId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("atualizarLogoEmpresa:", error.message);
    return { error: "Não foi possível salvar o logo. Tente novamente." };
  }
  // Um .update() que não bate com nenhuma linha retorna error: null mesmo
  // sem alterar nada (ver CLAUDE.md, regra 1) — foi exatamente essa falha
  // silenciosa, nesta mesma função, que causou o primeiro bug real deste
  // projeto. Este check é o que garante que não volte a passar despercebido.
  if (!data) {
    console.error(
      "atualizarLogoEmpresa: update não afetou nenhuma linha para empresaId=",
      user.empresaId,
    );
    return {
      error:
        "Não foi possível confirmar o salvamento do logo. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "empresas",
    registroId: user.empresaId,
    acao: "atualizado",
    usuarioId: user.id,
    detalhes: {
      nome: user.empresaNome,
      acao_logo: logoDataUrl === null ? "removido" : "atualizado",
    },
  });

  revalidatePath("/empresa");
  return { error: null };
}

export type AtualizarEmailCobrancaState = {
  error: string | null;
  // Mensagem informativa (não é erro) — hoje só usada quando a empresa
  // ainda não tem assinatura/cliente no Asaas pra sincronizar (ver abaixo).
  aviso?: string | null;
};

// Validação de formato simples — mesmo nível de rigor usado nos outros
// formulários do MorSafe, não tenta confirmar que o domínio existe de
// verdade.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Salva (ou remove, passando string vazia) o e-mail de cobrança ADICIONAL
 * da empresa — pedido do Rafael, 29/10/2026: deixar a empresa cliente
 * indicar um e-mail de cobrança diferente do e-mail de login do admin
 * (ex. um financeiro@), que também recebe as notificações do Asaas, sem
 * trocar nem deixar de usar o e-mail de login pra nada. Aceita mais de um
 * endereço separados por vírgula — mesmo formato que o campo
 * `additionalEmails` do Asaas já exige (ver atualizarClienteAsaas,
 * lib/asaas/client.ts) — e nunca toca no e-mail de login nem no cadastro
 * em `usuarios`/Supabase Auth.
 *
 * Ordem de gravação importa: primeiro tenta atualizar o Asaas (quando a
 * empresa já tem assinatura/cliente lá) e só grava em `empresas` DEPOIS do
 * Asaas confirmar — ao contrário de atualizarLogoEmpresa (que só grava
 * local, nunca fala com o Asaas). Isso evita o cenário de salvar aqui e o
 * Asaas continuar mandando cobrança só pro e-mail antigo sem nenhum aviso,
 * que era exatamente o risco que o Rafael levantou ("tomando cuidado com o
 * Asaas"). Empresa sem assinatura ainda (plano "interno", ver setup-
 * empresa/actions.ts) não tem cliente no Asaas pra atualizar: salva só
 * localmente nesse caso (devolvendo um aviso, não um erro), e passa a
 * sincronizar automaticamente da próxima vez que alguém salvar este campo
 * já com a assinatura ativa.
 */
export async function atualizarEmailCobrancaEmpresa(
  emailCobranca: string,
): Promise<AtualizarEmailCobrancaState> {
  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: "Seu perfil de acesso não permite essa ação." };
  }

  const emailsLimpos = emailCobranca
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  for (const email of emailsLimpos) {
    if (!EMAIL_REGEX.test(email)) {
      return { error: `"${email}" não parece ser um e-mail válido.` };
    }
  }

  const valorFinal = emailsLimpos.join(",");
  const supabase = await createClient();

  // Mesma tabela/coluna já usadas em app/(app)/pagamentos/actions.ts pra
  // achar o cliente Asaas de uma empresa.
  const { data: assinatura, error: erroAssinatura } = await supabase
    .from("assinaturas")
    .select("asaas_customer_id")
    .eq("empresa_id", user.empresaId)
    .maybeSingle();

  if (erroAssinatura) {
    console.error(
      "atualizarEmailCobrancaEmpresa (buscar assinatura):",
      erroAssinatura.message,
    );
    return {
      error: "Não foi possível verificar a assinatura da empresa. Tente novamente.",
    };
  }

  const asaasCustomerId = assinatura?.asaas_customer_id ?? null;
  let aviso: string | null = null;

  if (asaasCustomerId) {
    try {
      await atualizarClienteAsaas(asaasCustomerId, {
        additionalEmails: valorFinal,
      });
    } catch (e) {
      console.error("atualizarEmailCobrancaEmpresa (Asaas):", e);
      return {
        error:
          "Não foi possível atualizar o e-mail de cobrança no Asaas agora. Tente novamente em alguns minutos.",
      };
    }
  } else {
    aviso =
      "E-mail salvo. Esta empresa ainda não tem assinatura ativa no Asaas — a cobrança passará a usar este e-mail automaticamente quando a assinatura for criada.";
  }

  const { data, error } = await supabase
    .from("empresas")
    .update({ email_cobranca: valorFinal || null })
    .eq("id", user.empresaId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("atualizarEmailCobrancaEmpresa (salvar):", error.message);
    return {
      error: asaasCustomerId
        ? "O Asaas já foi atualizado, mas não foi possível salvar aqui no MorSafe. Avise o suporte do MorSafe."
        : "Não foi possível salvar o e-mail. Tente novamente.",
    };
  }
  // Mesmo check de "update que não afetou nenhuma linha" de
  // atualizarLogoEmpresa acima (ver comentário lá) — repetido aqui pelo
  // mesmo motivo.
  if (!data) {
    console.error(
      "atualizarEmailCobrancaEmpresa: update não afetou nenhuma linha para empresaId=",
      user.empresaId,
    );
    return {
      error:
        "Não foi possível confirmar o salvamento. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "empresas",
    registroId: user.empresaId,
    acao: "atualizado",
    usuarioId: user.id,
    detalhes: {
      nome: user.empresaNome,
      acao_email_cobranca: valorFinal ? "atualizado" : "removido",
    },
  });

  revalidatePath("/empresa");
  return { error: null, aviso };
}

export type AtualizarLogoUnidadeState = { error: string | null };

/**
 * Salva (ou remove, passando null) o logo de uma unidade/filial do grupo
 * (ex: Vinitrade, separada da ViniPlast), exibido no topo da Ficha de EPI
 * dos colaboradores daquela unidade no lugar do logo da empresa — ver
 * getColaboradorDetalhe (lib/data/colaboradores.ts) e colaboradores/[id]
 * /ficha/route.ts. Mesmo padrão de defesa de atualizarLogoEmpresa acima:
 * papel mínimo "admin" checado no servidor, e a conferência de que o
 * .update() de verdade afetou uma linha (ver CLAUDE.md, regra 1) — aqui
 * reforçada com um .eq("empresa_id", ...) extra, além do RLS da tabela
 * unidades, porque o id da unidade vem de um botão na tela (não só do
 * usuário autenticado, como em atualizarLogoEmpresa).
 */
export async function atualizarLogoUnidade(
  unidadeId: string,
  logoDataUrl: string | null,
): Promise<AtualizarLogoUnidadeState> {
  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "admin")) {
    return { error: "Seu perfil de acesso não permite essa ação." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unidades")
    .update({ logo_url: logoDataUrl })
    .eq("id", unidadeId)
    .eq("empresa_id", user.empresaId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("atualizarLogoUnidade:", error.message);
    return { error: "Não foi possível salvar o logo. Tente novamente." };
  }
  if (!data) {
    console.error(
      "atualizarLogoUnidade: update não afetou nenhuma linha para unidadeId=",
      unidadeId,
    );
    return {
      error:
        "Não foi possível confirmar o salvamento do logo. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "unidades",
    registroId: unidadeId,
    acao: "atualizado",
    usuarioId: user.id,
    detalhes: {
      acao_logo: logoDataUrl === null ? "removido" : "atualizado",
    },
  });

  revalidatePath("/empresa");
  return { error: null };
}
