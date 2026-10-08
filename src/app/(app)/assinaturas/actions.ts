"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/data/current-user";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";
import {
  cancelarAssinaturaAsaas,
  atualizarValorAssinaturaAsaas,
  AsaasError,
} from "@/lib/asaas/client";
import {
  PLANO_LABEL,
  PLANO_VALOR_MENSAL,
  PLANO_LIMITE_COLABORADORES,
  PLANOS_ORDENADOS,
} from "@/lib/data/planos";
import type { PlanoAssinatura } from "@/types/database";

export type CancelarAssinaturaResult = { error: string | null };

/**
 * Cancela a assinatura recorrente de uma empresa cliente — decisão
 * explícita do super_admin (nunca automática: ver StatusAssinatura em
 * types/database.ts), disparada no painel /assinaturas.
 *
 * Ordem de segurança do dinheiro — invertida em relação a criarEmpresa
 * (setup-empresa/actions.ts): lá a gravação local vem ANTES da chamada ao
 * Asaas (pra nunca cobrar algo sem rastro local); aqui o cancelamento no
 * Asaas vem ANTES da gravação local (pra nunca marcar "cancelada" aqui
 * enquanto a cobrança real continua ativa lá). Mesmo princípio dos dois
 * lados: a fonte da verdade sobre "está cobrando ou não" é o Asaas, nunca
 * o banco local sozinho.
 */
export async function cancelarAssinatura(
  assinaturaId: string,
): Promise<CancelarAssinaturaResult> {
  const requester = await getCurrentUser();
  if (!requester || requester.papel !== "super_admin") {
    return { error: "Acesso restrito." };
  }

  const admin = createAdminClient();

  const { data: assinatura, error: buscaError } = await admin
    .from("assinaturas")
    .select(
      "id, empresa_id, status, asaas_subscription_id, empresas ( nome )",
    )
    .eq("id", assinaturaId)
    .maybeSingle();

  if (buscaError || !assinatura) {
    console.error("cancelarAssinatura (busca):", buscaError?.message);
    return { error: "Assinatura não encontrada." };
  }

  if (assinatura.status === "cancelada") {
    return { error: null }; // já cancelada — idempotente, nada a fazer.
  }

  if (assinatura.asaas_subscription_id) {
    try {
      await cancelarAssinaturaAsaas(assinatura.asaas_subscription_id);
    } catch (e) {
      // 404 = o Asaas já não tem essa assinatura (ex.: cancelada por lá
      // manualmente) — não é um erro real, segue pro cancelamento local.
      // Qualquer OUTRO status é um erro de verdade: não marca "cancelada"
      // aqui enquanto o Asaas continua cobrando de verdade.
      const ja404 = e instanceof AsaasError && e.status === 404;
      if (!ja404) {
        console.error("cancelarAssinatura (Asaas):", e);
        const mensagemAsaas = e instanceof AsaasError ? e.message : null;
        return {
          error: mensagemAsaas
            ? `Não foi possível cancelar no Asaas: ${mensagemAsaas}. A cobrança continua ativa lá — tente novamente.`
            : "Não foi possível cancelar no Asaas. A cobrança continua ativa lá — tente novamente.",
        };
      }
    }
  }

  const agora = new Date().toISOString();
  const { error: updateError } = await admin
    .from("assinaturas")
    .update({ status: "cancelada", cancelada_em: agora, atualizado_em: agora })
    .eq("id", assinaturaId);

  if (updateError) {
    // O cancelamento no Asaas (se existia asaas_subscription_id) já valeu
    // — a cobrança real já parou. Só a gravação local falhou: loga bem
    // visível em vez de devolver erro, que levaria a tentar de novo algo
    // que já está resolvido do lado que importa pro dinheiro (mesmo
    // raciocínio da falha pós-sucesso em criarEmpresa).
    console.error(
      `cancelarAssinatura: cancelado no Asaas mas falhou ao gravar localmente (assinatura ${assinaturaId}): ${updateError.message}`,
    );
    return {
      error:
        "Cancelado no Asaas, mas houve uma falha ao atualizar aqui. Avise o suporte do MorSafe.",
    };
  }

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: assinatura.empresa_id,
    tabela: "assinaturas",
    registroId: assinaturaId,
    acao: "assinatura_cancelada",
    usuarioId: requester.id,
    detalhes: {
      nome:
        (assinatura.empresas as unknown as { nome: string } | null)?.nome ??
        null,
    },
  });

  return { error: null };
}

export type AlterarPlanoResult = { error: string | null };

/**
 * Upgrade/downgrade de plano de uma assinatura já ativa — atualiza o
 * valor no Asaas (cobranças futuras passam a usar o novo valor, ver
 * atualizarValorAssinaturaAsaas) e reflete o novo plano/valor/limite de
 * colaboradores aqui no MorSafe.
 *
 * Mesma ordem de segurança do dinheiro de cancelarAssinatura: a
 * atualização no Asaas vem ANTES da gravação local, pra nunca mostrar um
 * valor/plano novo aqui enquanto o Asaas continua cobrando o valor
 * antigo.
 */
export async function alterarPlanoAssinatura(
  assinaturaId: string,
  novoPlanoBruto: string,
  valorEnterpriseBruto?: string,
): Promise<AlterarPlanoResult> {
  const requester = await getCurrentUser();
  if (!requester || requester.papel !== "super_admin") {
    return { error: "Acesso restrito." };
  }

  if (!PLANOS_ORDENADOS.includes(novoPlanoBruto as PlanoAssinatura)) {
    return { error: "Plano inválido." };
  }
  const novoPlano = novoPlanoBruto as PlanoAssinatura;

  let novoValor: number;
  if (novoPlano === "enterprise") {
    novoValor = Number((valorEnterpriseBruto ?? "").trim().replace(",", "."));
    if (!novoValor || novoValor <= 0) {
      return { error: "Informe o valor mensal negociado pro plano Enterprise." };
    }
  } else {
    novoValor = PLANO_VALOR_MENSAL[novoPlano];
  }

  const admin = createAdminClient();

  const { data: assinatura, error: buscaError } = await admin
    .from("assinaturas")
    .select(
      "id, empresa_id, plano, valor_mensal, status, asaas_subscription_id, empresas ( nome )",
    )
    .eq("id", assinaturaId)
    .maybeSingle();

  if (buscaError || !assinatura) {
    console.error("alterarPlanoAssinatura (busca):", buscaError?.message);
    return { error: "Assinatura não encontrada." };
  }

  if (assinatura.status === "cancelada") {
    return {
      error:
        "Esta assinatura está cancelada — não é possível mudar o plano dela. Cadastre uma assinatura nova.",
    };
  }

  const planoAnterior = assinatura.plano;
  const valorAnterior = Number(assinatura.valor_mensal);
  if (planoAnterior === novoPlano && valorAnterior === novoValor) {
    return { error: null }; // nada mudou — idempotente.
  }

  if (assinatura.asaas_subscription_id) {
    try {
      await atualizarValorAssinaturaAsaas(assinatura.asaas_subscription_id, {
        valor: novoValor,
        descricao: `Assinatura MorSafe — plano ${novoPlano}`,
      });
    } catch (e) {
      console.error("alterarPlanoAssinatura (Asaas):", e);
      const mensagemAsaas = e instanceof AsaasError ? e.message : null;
      return {
        error: mensagemAsaas
          ? `Não foi possível atualizar o valor no Asaas: ${mensagemAsaas}. O plano não foi alterado.`
          : "Não foi possível atualizar o valor no Asaas. O plano não foi alterado.",
      };
    }
  } else {
    // Defensivo: toda assinatura comercial deveria ter um
    // asaas_subscription_id (ver criarEmpresa) — se não tiver, algo saiu
    // errado na implantação original. Segue só localmente, mas avisa
    // bem alto pra investigação manual, em vez de travar a mudança de
    // plano por uma inconsistência que já existia antes.
    console.error(
      `alterarPlanoAssinatura: assinatura ${assinaturaId} sem asaas_subscription_id — atualizando só localmente.`,
    );
  }

  const agora = new Date().toISOString();
  const { error: updateError } = await admin
    .from("assinaturas")
    .update({
      plano: novoPlano,
      valor_mensal: novoValor,
      atualizado_em: agora,
    })
    .eq("id", assinaturaId);

  if (updateError) {
    console.error(
      `alterarPlanoAssinatura: valor atualizado no Asaas mas falhou ao gravar localmente (assinatura ${assinaturaId}): ${updateError.message}`,
    );
    return {
      error:
        "Atualizado no Asaas, mas houve uma falha ao gravar aqui. Avise o suporte do MorSafe.",
    };
  }

  // Limite de colaboradores sugerido acompanha o novo plano — exceto
  // Enterprise, que não tem limite fixo (sob consulta, ver planos.ts); o
  // super_admin pode ajustar manualmente depois em /empresas/[id], igual
  // já é feito pra qualquer empresa. Fallback igual ao de criarEmpresa —
  // coluna ainda pendente de aplicação em algumas bases. Tolera tanto
  // 42703 quanto PGRST204 (código real que o PostgREST devolve quando não
  // acha a coluna no schema cache, confirmado em produção — ver
  // definirLimiteColaboradores, empresas/actions.ts); só 42703 deixava
  // esse log disparar à toa mesmo no caso esperado.
  if (novoPlano !== "enterprise") {
    const { error: limiteError } = await admin
      .from("empresas")
      .update({ limite_colaboradores: PLANO_LIMITE_COLABORADORES[novoPlano] })
      .eq("id", assinatura.empresa_id);

    if (
      limiteError &&
      limiteError.code !== "42703" &&
      limiteError.code !== "PGRST204"
    ) {
      console.error(
        `alterarPlanoAssinatura: falha ao atualizar limite_colaboradores (empresa ${assinatura.empresa_id}): ${limiteError.message}`,
      );
      // Não bloqueia a troca de plano por isso — o limite é só uma
      // sugestão/alerta (ver CLAUDE.md regra 4: acessório nunca trava o
      // principal), a mudança de plano/cobrança em si já valeu.
    }
  }

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: assinatura.empresa_id,
    tabela: "assinaturas",
    registroId: assinaturaId,
    acao: "plano_alterado",
    usuarioId: requester.id,
    detalhes: {
      nome:
        (assinatura.empresas as unknown as { nome: string } | null)?.nome ??
        null,
      de: PLANO_LABEL[planoAnterior],
      para: PLANO_LABEL[novoPlano],
      valorAnterior,
      valorNovo: novoValor,
    },
  });

  return { error: null };
}
