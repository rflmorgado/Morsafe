import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Endpoint que recebe os eventos de cobrança do Asaas (ver modelo
 * comercial, seção 6: "Webhook e atualização automática"). Configurar no
 * painel do Asaas (Integrações > Webhooks) apontando pra
 * https://<domínio>/api/webhooks/asaas, com o MESMO valor em "Token de
 * autenticação" que estiver na variável de ambiente ASAAS_WEBHOOK_TOKEN
 * aqui no Vercel — é assim que o Asaas e o MorSafe concordam no segredo
 * sem ele nunca aparecer em nenhum lugar público.
 *
 * Esta rota roda SEM usuário logado (quem chama é o servidor do Asaas, não
 * alguém usando o app) — por isso usa sempre o cliente admin, nunca o
 * cliente comum, e por isso a autenticação é feita pelo token no header,
 * não por sessão.
 *
 * Fase 1 (ver seção 14 do modelo comercial): trata só os eventos que
 * movem o ciclo normal de cobrança (nova cobrança → paga → vencida).
 * Estorno, chargeback e split ficam pra Fase 2, de propósito — não fazem
 * parte do fluxo básico que os primeiros clientes vão gerar.
 */

const EVENTOS_TRATADOS = new Set([
  "PAYMENT_CREATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
]);

type AsaasWebhookPayload = {
  id: string;
  event: string;
  payment?: {
    id: string;
    customer: string;
    subscription?: string | null;
    status: string;
    value: number;
    dueDate: string;
    paymentDate?: string | null;
    // Link da fatura hospedada pelo Asaas — ver comentário de
    // asaas_invoice_url em types/database.ts. Opcional porque nem todo
    // evento/cobrança necessariamente traz esse campo preenchido.
    invoiceUrl?: string | null;
  };
};

/**
 * Comparação em tempo constante — evita que um atacante descubra o token
 * certo testando valores e medindo quanto tempo cada tentativa leva
 * (timing attack). Tokens de tamanho diferente nunca são iguais, então
 * nem chega a comparar byte a byte nesse caso (timingSafeEqual exige
 * buffers do mesmo tamanho, senão lança exceção em vez de devolver
 * false).
 */
function tokenValido(recebido: string | null, esperado: string): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!tokenEsperado) {
    console.error(
      "Webhook Asaas: ASAAS_WEBHOOK_TOKEN não configurada no servidor.",
    );
    return new Response("Configuração do servidor incompleta.", {
      status: 500,
    });
  }

  const tokenRecebido = request.headers.get("asaas-access-token");
  if (!tokenValido(tokenRecebido, tokenEsperado)) {
    console.error("Webhook Asaas: token inválido ou ausente.");
    return new Response("Não autorizado.", { status: 401 });
  }

  let body: AsaasWebhookPayload;
  try {
    body = await request.json();
  } catch {
    return new Response("Corpo inválido.", { status: 400 });
  }

  if (!body.id || !body.event) {
    return new Response("Payload incompleto.", { status: 400 });
  }

  const admin = createAdminClient();

  // Dedup por evento_id — se o Asaas reenviar a mesma entrega (acontece
  // em caso de timeout/instabilidade), a segunda tentativa de INSERT cai
  // no "unique_violation" (23505) e a rota responde 200 sem reprocessar
  // nada, exatamente como se a primeira tivesse funcionado — pro Asaas
  // não ficar retentando pra sempre.
  const { error: eventoError } = await admin
    .from("asaas_webhook_events")
    .insert({ evento_id: body.id, evento_tipo: body.event });

  if (eventoError) {
    if (eventoError.code === "23505") {
      return new Response("OK (evento já processado)", { status: 200 });
    }
    console.error("Webhook Asaas: falha ao gravar dedup:", eventoError.message);
    // Erro de verdade (não duplicata) — devolve 500 pro Asaas tentar de
    // novo mais tarde, em vez de fingir sucesso e perder o evento.
    return new Response("Erro ao registrar evento.", { status: 500 });
  }

  if (!EVENTOS_TRATADOS.has(body.event) || !body.payment) {
    // Evento reconhecido pelo Asaas mas fora do escopo da Fase 1 (ver
    // comentário no topo) — grava o dedup (já feito acima) e confirma
    // recebimento sem efeito colateral nenhum.
    return new Response("OK (evento fora do escopo)", { status: 200 });
  }

  try {
    await processarEventoPagamento(admin, body.event, body.payment);
  } catch (e) {
    console.error("Webhook Asaas: falha ao processar pagamento:", e);
    return new Response("Erro ao processar pagamento.", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

async function processarEventoPagamento(
  admin: ReturnType<typeof createAdminClient>,
  evento: string,
  payment: NonNullable<AsaasWebhookPayload["payment"]>,
) {
  const pago = evento === "PAYMENT_CONFIRMED" || evento === "PAYMENT_RECEIVED";

  // payment.subscription só vem preenchido pra cobrança gerada por uma
  // assinatura recorrente (billingType "UNDEFINED" criado em
  // criarAssinaturaAsaas, lib/asaas/client.ts). Cobrança AVULSA — hoje só
  // a taxa de implantação, criada por criarCobrancaAvulsaAsaas via
  // criarPagamento, app/(app)/pagamentos/actions.ts — nunca tem
  // subscription, e não deve tocar em `assinaturas` (não representa o
  // ciclo de mensalidade de ninguém).
  if (!payment.subscription) {
    await processarCobrancaAvulsa(admin, evento, payment, pago);
    return;
  }

  // Acha a empresa pelo asaas_subscription_id (cobrança de assinatura).
  const { data: assinatura, error: assinaturaError } = await admin
    .from("assinaturas")
    .select("id, empresa_id, status")
    .eq("asaas_subscription_id", payment.subscription)
    .maybeSingle();

  if (assinaturaError || !assinatura) {
    console.error(
      `Webhook Asaas: assinatura não encontrada pra subscription ${payment.subscription} (evento ${evento}, payment ${payment.id}).`,
    );
    // Não lança erro — isso faria o Asaas reenviar pra sempre uma
    // cobrança que nunca vai achar uma assinatura (cenário típico: dado
    // de teste/sandbox desalinhado). Fica só o log pra investigar.
    return;
  }

  // Upsert por asaas_payment_id — idempotente mesmo que o Asaas mande
  // PAYMENT_CREATED e, segundos depois, PAYMENT_CONFIRMED pra mesma
  // cobrança (ambos caem aqui, o segundo só atualiza o primeiro).
  const { error: pagamentoError } = await admin
    .from("pagamentos_empresa")
    .upsert(
      {
        empresa_id: assinatura.empresa_id,
        asaas_payment_id: payment.id,
        valor: payment.value,
        data_vencimento: payment.dueDate,
        status: pago ? "pago" : "pendente",
        data_pagamento: payment.paymentDate ?? null,
        // ?? null em vez de omitir — o Asaas manda esse campo em praticamente
        // todo evento de pagamento, então sobrescrever com null num evento
        // raro sem ele não é um risco real, e simplifica (sem precisar
        // montar o objeto condicionalmente).
        asaas_invoice_url: payment.invoiceUrl ?? null,
      },
      { onConflict: "asaas_payment_id" },
    );

  if (pagamentoError) {
    throw new Error(`Falha ao gravar pagamento: ${pagamentoError.message}`);
  }

  // Status da assinatura segue o evento — nunca pula direto pra
  // "suspensa": suspensão automática por inadimplência prolongada é a
  // régua de inadimplência (fase separada, ver CLAUDE.md/roadmap), não
  // uma reação direta a um único PAYMENT_OVERDUE.
  const novoStatus =
    evento === "PAYMENT_CREATED"
      ? "pendente"
      : pago
        ? "ativa"
        : evento === "PAYMENT_OVERDUE"
          ? "inadimplente"
          : assinatura.status;

  const { error: statusError } = await admin
    .from("assinaturas")
    .update({
      status: novoStatus,
      proximo_vencimento: payment.dueDate,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", assinatura.id);

  if (statusError) {
    throw new Error(`Falha ao atualizar status da assinatura: ${statusError.message}`);
  }
}

/**
 * Cobrança avulsa (sem subscription — ver comentário acima). A empresa é
 * achada pelo asaas_customer_id gravado em `assinaturas` na implantação
 * (ver criarEmpresa, setup-empresa/actions.ts) — é o único vínculo que o
 * Asaas manda nesse caso (payment.customer), já que não existe uma
 * assinatura por trás desta cobrança específica.
 *
 * Upsert por asaas_payment_id, igual ao fluxo de assinatura: se a linha
 * local já existir (criada por criarPagamento ANTES de chamar o Asaas,
 * com o id gravado só depois que o Asaas responde — ver lá), o upsert só
 * atualiza o valor/status/vencimento vindos do Asaas. Se o webhook chegar
 * antes dessa gravação (corrida improvável, mas possível), o upsert cria
 * a linha aqui mesmo — nesse caso ela nasce sem o resto dos campos que
 * criarPagamento também grava (observacao), o que é aceitável: o essencial
 * (valor, vencimento, status) sempre vem do Asaas, fonte da verdade.
 */
async function processarCobrancaAvulsa(
  admin: ReturnType<typeof createAdminClient>,
  evento: string,
  payment: NonNullable<AsaasWebhookPayload["payment"]>,
  pago: boolean,
) {
  const { data: assinaturaDoCliente, error: clienteError } = await admin
    .from("assinaturas")
    .select("empresa_id")
    .eq("asaas_customer_id", payment.customer)
    .maybeSingle();

  if (clienteError || !assinaturaDoCliente) {
    console.error(
      `Webhook Asaas: cobrança avulsa sem empresa correspondente pro customer ${payment.customer} (evento ${evento}, payment ${payment.id}).`,
    );
    // Mesmo raciocínio do caso de assinatura: não lança erro, só loga —
    // evita reenvio infinito do Asaas por um dado de teste/sandbox
    // desalinhado.
    return;
  }

  const { error: pagamentoError } = await admin
    .from("pagamentos_empresa")
    .upsert(
      {
        empresa_id: assinaturaDoCliente.empresa_id,
        asaas_payment_id: payment.id,
        valor: payment.value,
        data_vencimento: payment.dueDate,
        status: pago ? "pago" : "pendente",
        data_pagamento: payment.paymentDate ?? null,
        asaas_invoice_url: payment.invoiceUrl ?? null,
      },
      { onConflict: "asaas_payment_id" },
    );

  if (pagamentoError) {
    throw new Error(`Falha ao gravar cobrança avulsa: ${pagamentoError.message}`);
  }
}
