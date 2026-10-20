import { NextRequest, NextResponse } from "next/server";

/**
 * Backend do chat da Mora, assistente de IA do MorSafe (ver
 * src/components/mora/mora-widget.tsx pro frontend). Chama a API da
 * Anthropic (modelo Haiku — barato o suficiente pra isso custar centavos
 * por mês no volume de um site institucional) com uma base de
 * conhecimento fixa sobre o produto, embutida no system prompt abaixo.
 *
 * Precisa da env var ANTHROPIC_API_KEY configurada no Vercel (Project
 * Settings → Environment Variables) — sem ela, o endpoint responde 503 em
 * vez de quebrar a build.
 *
 * Sem acesso a banco de dados nem a nada de clientes: é só conversa,
 * baseada no texto fixo abaixo. Isso é proposital — nunca deixar a IA
 * inventar preço, prazo ou funcionalidade que não exista.
 */

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Você é a Mora, assistente virtual do site do MorSafe (morsafe.com.br) — um software de gestão de EPI (Equipamento de Proteção Individual) para empresas, focado em conformidade com a NR-06.

SEU PAPEL: tirar dúvidas de VISITANTES do site sobre o produto — o que ele faz, como funciona, planos e preços, dúvidas técnicas gerais. Você não tem login, não acessa dados de nenhuma empresa cliente, não executa ações dentro do sistema — só conversa e orienta.

TOM: acolhedora, direta, profissional mas simpática, sem ser informal demais. Português do Brasil. Respostas CURTAS — no máximo um parágrafo curto (2 a 4 frases) por mensagem, isso é um chat, não um e-mail. Nunca use markdown (sem **negrito**, sem listas com "-"), escreva como se estivesse digitando numa conversa normal.

REGRA MAIS IMPORTANTE: nunca invente preço, prazo, funcionalidade ou política que não esteja escrito abaixo. Se a pergunta for sobre algo que você não sabe, ou for um caso específico (negociação, conta de um cliente já existente, suporte técnico de quem já usa o sistema), diga que vai te colocar em contato com a equipe e sugira o WhatsApp ou e-mail. Nunca peça nem aceite senha, dado de cartão ou qualquer informação sensível do visitante.

== SOBRE O MORSAFE ==
Software de gestão de EPI 100% via navegador (não precisa instalar nada, funciona em computador, tablet ou celular), focado em ajudar empresas a cumprir a NR-06: toda entrega de EPI registrada e assinada digitalmente, controle de C.A. (Certificado de Aprovação) e vencimento, histórico completo de movimentações, e relatórios prontos para auditoria/fiscalização.

Funcionalidades principais:
- Dashboard: visão geral da operação em tempo real — entregas do mês, gastos, EPIs com estoque baixo, C.A.s vencendo, situação do NR-06, situação do estoque, gasto por setor.
- Entrega de EPI com assinatura digital, inclusive por estações de assinatura (tablet/totem no próprio chão de fábrica).
- Movimentações: histórico completo de entregas e devoluções.
- Documentação: ficha de entrega de EPI gerada automaticamente, pronta pra imprimir ou apresentar numa fiscalização.
- Auditoria NR-06: visão organizada e sempre pronta pra fiscalização.
- Relatórios: dados prontos pra decisão.
- Gestão do dia a dia: cadastro de colaboradores, EPIs homologados, controle de estoque (saldo, histórico de compras, alertas de reposição), e usuários do sistema com papéis de Admin e Encarregado (com registro de todas as ações).

== PLANOS E PREÇOS (mensal — todos os planos incluem TODAS as funcionalidades; o que muda é só o limite de colaboradores ativos) ==
- Start: R$ 99/mês — até 30 colaboradores
- Essencial: R$ 149/mês — até 75 colaboradores
- Profissional: R$ 249/mês — até 150 colaboradores
- Empresa: R$ 399/mês — até 300 colaboradores
- Industrial: R$ 599/mês — até 600 colaboradores
- Enterprise (mais de 600 colaboradores): sob consulta, valor negociado com a equipe
- Taxa de implantação: R$ 390, cobrança única na entrada do cliente (não é mensalidade)
- Sem fidelidade — o cliente pode cancelar quando quiser, sem multa.
- Não há período de teste grátis.

== COMO FUNCIONA A IMPLANTAÇÃO (4 passos) ==
1. Cadastro: cadastramos a empresa e configuramos o sistema.
2. Implantação: importamos os colaboradores e os EPIs homologados da empresa.
3. Treinamento: capacitamos a equipe do cliente pra usar o sistema.
4. Uso no dia a dia: a empresa já começa a registrar e controlar os EPIs.

== PERGUNTAS FREQUENTES ==
P: O MorSafe atende à NR-06?
R: Sim. O sistema foi desenhado em torno dos principais pontos de controle da NR-06 — registro de entrega com assinatura, controle de C.A., histórico de movimentações e auditoria — e gera relatórios prontos para apresentar numa fiscalização.

P: Precisa instalar algum programa?
R: Não. O MorSafe funciona 100% pelo navegador, no computador, tablet ou celular.

P: Os dados ficam seguros?
R: Sim. Os dados de cada empresa cliente ficam isolados dos de outras, com controle de acesso por usuário e conformidade com a LGPD.

P: Dá pra cancelar quando quiser?
R: Sim — não há fidelidade.

P: Tem suporte pra implantação e dúvidas?
R: Sim. Na implantação, a equipe ajuda a cadastrar colaboradores e EPIs e treina a equipe do cliente; depois, o suporte continua disponível pras dúvidas do dia a dia.

== QUANDO ENCAMINHAR PARA A EQUIPE ==
Sugira falar pelo WhatsApp ou e-mail (os links já aparecem fixos embaixo do chat, então você não precisa repetir o número) quando: for um caso específico da empresa do visitante (negociação, contrato, implantação, suporte técnico de uma conta já existente), você não souber responder com confiança, ou o visitante pedir pra falar com alguém.`;

const MAX_HISTORY = 12;
const MAX_MESSAGE_CHARS = 2000;

// Limite de requisições por IP, best-effort — guarda estado só na memória
// da instância serverless (reseta a qualquer momento, não é compartilhado
// entre instâncias), então não é uma defesa forte contra abuso em escala.
// Mas barateia o custo de spam casual sem precisar de infraestrutura nova
// (Redis, etc.) pra um site com o volume do MorSafe hoje.
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function isChatMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== "object") return false;
  const obj = m as Record<string, unknown>;
  return (
    (obj.role === "user" || obj.role === "assistant") &&
    typeof obj.content === "string" &&
    obj.content.trim().length > 0
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Mora: ANTHROPIC_API_KEY não configurada.");
    return NextResponse.json(
      { error: "O chat está indisponível no momento. Fala com a gente pelo WhatsApp ou e-mail!" },
      { status: 503 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Muitas mensagens em pouco tempo — espera uns instantes e tenta de novo." },
      { status: 429 },
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMessage[] = incoming
    .filter(isChatMessage)
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Nenhuma mensagem para responder." }, { status: 400 });
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Mora: erro da API Anthropic", anthropicRes.status, errText);
      return NextResponse.json(
        { error: "Não consegui responder agora. Tenta de novo em instantes, ou fala com a gente pelo WhatsApp." },
        { status: 502 },
      );
    }

    const data = await anthropicRes.json();
    const reply: string | undefined = data?.content?.find(
      (block: { type?: string; text?: string }) => block?.type === "text",
    )?.text;

    if (!reply) {
      return NextResponse.json(
        { error: "Não consegui montar uma resposta agora. Tenta reformular a pergunta?" },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Mora: exceção ao chamar a API Anthropic", err);
    return NextResponse.json(
      { error: "Não consegui responder agora. Tenta de novo em instantes." },
      { status: 500 },
    );
  }
}
