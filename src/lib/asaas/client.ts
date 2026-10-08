/**
 * Cliente mínimo da API do Asaas — só os endpoints que o MorSafe precisa
 * (criar cliente, criar/atualizar/cancelar assinatura recorrente, consultar
 * cobrança), não um SDK completo. Usado só no servidor (Server Actions,
 * Route Handlers), nunca importado por um componente "use client" — a
 * API key do Asaas não pode vazar pro navegador.
 *
 * Variáveis de ambiente exigidas (Vercel > Settings > Environment
 * Variables):
 *   ASAAS_API_KEY — a api key gerada no painel do Asaas (Configurações
 *     > Integrações > API). Uma para sandbox, outra pra produção — são
 *     chaves diferentes, nunca a mesma.
 *   ASAAS_ENV — "sandbox" ou "production". Ausente ou qualquer outro
 *     valor é tratado como "sandbox" de propósito (falha segura: nunca
 *     cobra dinheiro de verdade por engano só porque a variável não foi
 *     configurada ainda).
 *
 * Bases oficiais (ver docs.asaas.com/docs/autenticação):
 *   produção: https://api.asaas.com/v3
 *   sandbox:  https://sandbox.asaas.com/api/v3
 */

const ASAAS_BASE_URL_PRODUCAO = "https://api.asaas.com/v3";
const ASAAS_BASE_URL_SANDBOX = "https://sandbox.asaas.com/api/v3";

export function isAsaasProducao(): boolean {
  return process.env.ASAAS_ENV === "production";
}

function getBaseUrl(): string {
  return isAsaasProducao() ? ASAAS_BASE_URL_PRODUCAO : ASAAS_BASE_URL_SANDBOX;
}

function getApiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) {
    throw new Error(
      "ASAAS_API_KEY não configurada. Adicione essa variável de ambiente no Vercel (Settings > Environment Variables) com a api key do Asaas (Configurações > Integrações > API no painel do Asaas) — uma chave de sandbox pra testar, outra de produção quando for cobrar de verdade (ver ASAAS_ENV).",
    );
  }
  return key;
}

export class AsaasError extends Error {
  constructor(
    message: string,
    public status: number,
    public corpo: unknown,
  ) {
    super(message);
    this.name = "AsaasError";
  }
}

async function asaasFetch<T>(
  caminho: string,
  init?: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: Record<string, unknown>;
  },
): Promise<T> {
  const resposta = await fetch(`${getBaseUrl()}${caminho}`, {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      // Nome do header é literalmente "access_token" (minúsculo, com
      // underscore) — ver docs.asaas.com/docs/autenticação. Diferente do
      // header do webhook (asaas-access-token, com hífen), que é outra
      // coisa (ver src/app/api/webhooks/asaas/route.ts).
      access_token: getApiKey(),
      "User-Agent": "MorSafe",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const corpo = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    // O Asaas devolve { errors: [{ description: "..." }] } em erro de
    // validação — extrai a primeira mensagem pra log, sem expor o corpo
    // cru pro usuário final (quem chama decide a mensagem amigável).
    const descricao =
      (corpo as { errors?: { description?: string }[] } | null)?.errors?.[0]
        ?.description ?? `HTTP ${resposta.status}`;
    throw new AsaasError(`Asaas: ${descricao}`, resposta.status, corpo);
  }

  return corpo as T;
}

export type AsaasCliente = {
  id: string;
  name: string;
  cpfCnpj: string;
  email: string | null;
};

/**
 * Cria o cliente (pagador) no Asaas — um por empresa cliente do MorSafe,
 * criado uma vez na implantação e reaproveitado em toda cobrança futura
 * dela. cpfCnpj é obrigatório pro Asaas processar Pix/boleto/cartão —
 * diferente do campo `empresas.cnpj` do MorSafe, que é opcional (só
 * exibição); quem chama esta função precisa garantir que o CNPJ foi
 * informado ANTES de chegar aqui (ver criarEmpresa, setup-empresa/
 * actions.ts).
 */
export async function criarClienteAsaas(dados: {
  nome: string;
  cpfCnpj: string;
  email: string;
  telefone?: string;
  // Id da empresa no MorSafe, gravado como referência externa no Asaas —
  // ajuda a conferir manualmente no painel do Asaas qual cliente de lá
  // corresponde a qual empresa daqui, sem precisar decorar nomes.
  referenciaExterna: string;
}): Promise<AsaasCliente> {
  return asaasFetch<AsaasCliente>("/customers", {
    method: "POST",
    body: {
      name: dados.nome,
      cpfCnpj: dados.cpfCnpj,
      email: dados.email,
      phone: dados.telefone,
      externalReference: dados.referenciaExterna,
    },
  });
}

export type AsaasAssinatura = {
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  status: string;
};

/**
 * Cria a assinatura recorrente no Asaas — o Asaas passa a gerar uma
 * cobrança nova automaticamente a cada ciclo (MONTHLY), sem o MorSafe
 * precisar disparar nada manualmente mês a mês. billingType "UNDEFINED"
 * deixa o próprio cliente escolher Pix/boleto/cartão na hora de pagar
 * cada cobrança, em vez de travar numa forma só.
 */
export async function criarAssinaturaAsaas(dados: {
  asaasCustomerId: string;
  valor: number;
  // Primeira cobrança — normalmente "hoje" na implantação, com as
  // seguintes já caindo automaticamente no dia 05 de cada mês seguinte
  // (ver seção 5 do modelo comercial).
  proximoVencimento: string;
  descricao: string;
  // Id da empresa no MorSafe, pra achar o caminho de volta no webhook
  // mesmo que, por algum motivo, o asaas_subscription_id ainda não
  // tenha sido gravado em `assinaturas` (idempotência extra).
  referenciaExterna: string;
}): Promise<AsaasAssinatura> {
  return asaasFetch<AsaasAssinatura>("/subscriptions", {
    method: "POST",
    body: {
      customer: dados.asaasCustomerId,
      billingType: "UNDEFINED",
      cycle: "MONTHLY",
      value: dados.valor,
      nextDueDate: dados.proximoVencimento,
      description: dados.descricao,
      externalReference: dados.referenciaExterna,
    },
  });
}

export type AsaasCobranca = {
  id: string;
  customer: string;
  subscription: string | null;
  status: string;
  value: number;
  dueDate: string;
  paymentDate: string | null;
};

/**
 * Consulta uma cobrança específica — usado hoje só como apoio manual
 * (confirmar no painel do MorSafe o que o Asaas diz sobre uma cobrança
 * específica, sem precisar abrir o painel do Asaas). O caminho normal de
 * atualização é o webhook (ver route.ts), não esta função.
 */
export async function consultarCobrancaAsaas(
  asaasPaymentId: string,
): Promise<AsaasCobranca> {
  return asaasFetch<AsaasCobranca>(`/payments/${asaasPaymentId}`);
}

/**
 * Atualiza o valor (e descrição) de uma assinatura recorrente já
 * existente — usado no fluxo de upgrade/downgrade de plano (ver
 * app/(app)/assinaturas/actions.ts). Confirmado em
 * docs.asaas.com/docs/faq-assinaturas ("é possível atualizar
 * configurações como valor, periodicidade, vencimento...") que o PUT
 * /subscriptions/{id} aceita "value" — a tabela de referência da API
 * (docs.asaas.com/reference/atualizar-assinatura-existente) não deixou
 * isso claro na leitura automática feita aqui, por isso: TESTAR em
 * sandbox antes de confiar nisso pra uma mudança de plano de cliente
 * real (ver ASAAS_ENV).
 *
 * updatePendingPayments: false de propósito — a mudança de valor só
 * vale pra cobranças FUTURAS (ainda não geradas); uma cobrança já
 * criada neste ciclo (gerada no vencimento anterior, talvez ainda não
 * paga) mantém o valor do plano antigo, pra nunca mudar o valor de algo
 * que o cliente já estava vendo/prestes a pagar. O novo valor só entra
 * em vigor no próximo vencimento gerado pelo Asaas.
 */
export async function atualizarValorAssinaturaAsaas(
  asaasSubscriptionId: string,
  dados: { valor: number; descricao: string },
): Promise<AsaasAssinatura> {
  return asaasFetch<AsaasAssinatura>(
    `/subscriptions/${asaasSubscriptionId}`,
    {
      method: "PUT",
      body: {
        value: dados.valor,
        description: dados.descricao,
        updatePendingPayments: false,
      },
    },
  );
}

export type AsaasCancelamento = {
  deleted: boolean;
  id: string;
};

/**
 * Cancela a assinatura recorrente no Asaas — para a geração de novas
 * cobranças a partir de agora (cobranças já criadas antes do cancelamento,
 * mas ainda não pagas, continuam existindo lá; o MorSafe não estorna nada
 * automaticamente). Usado pelo painel /assinaturas (ver
 * app/(app)/assinaturas/actions.ts), sempre ANTES de marcar a assinatura
 * como "cancelada" no banco local — nunca o contrário, pra nunca marcar
 * cancelado aqui enquanto o Asaas continua cobrando de verdade.
 *
 * Um 404 aqui (assinatura já não existe no Asaas — cancelada por lá
 * manualmente, por exemplo) não é tratado como sucesso por esta função:
 * ela só repassa o AsaasError, e é responsabilidade de quem chama decidir
 * que 404 significa "já está cancelado, pode seguir" (ver actions.ts).
 */
export async function cancelarAssinaturaAsaas(
  asaasSubscriptionId: string,
): Promise<AsaasCancelamento> {
  return asaasFetch<AsaasCancelamento>(
    `/subscriptions/${asaasSubscriptionId}`,
    { method: "DELETE" },
  );
}
