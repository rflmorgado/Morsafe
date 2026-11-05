import { timingSafeEqual } from "crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Checagem diária de saúde da plataforma — pedido do Rafael depois de dois
 * bugs (ficha em cache e assinatura destravando o botão) que só apareceram
 * num aparelho específico, meses depois de o código ter ido ao ar: ele quer
 * um sinal diário de "a plataforma está funcionando de ponta a ponta", não
 * só "o servidor está de pé".
 *
 * Deliberadamente NÃO faz login como um usuário de verdade nem grava nada
 * no banco de uma empresa real — duas linhas vermelhas por desenho:
 * 1) Login automatizado exigiria guardar a senha de alguém em algum lugar
 *    (aqui ou num agendador externo), e qualquer vazamento desse segredo
 *    vale como vazar a senha de verdade — risco que não compensa o
 *    benefício de um teste sintético.
 * 2) Criar uma entrega/devolução "de teste" todo dia numa empresa real
 *    poluiria o histórico de EPI dela — que é exatamente o tipo de registro
 *    que precisa ficar íntegro pra uma fiscalização (ver CLAUDE.md, regra
 *    3, sobre `entregas`/`devolucoes` serem imutáveis por design).
 *
 * Em vez disso, verifica os dois elos mais prováveis de quebrar sem
 * aparecer num "o site está no ar?" simples:
 *   - "database": o banco responde (Supabase, via service role) — pega
 *     fora do ar / chave expirada / RLS mal configurado bloqueando tudo.
 *   - "geracaoFicha": a MESMA cadeia de bibliotecas usada pra montar a
 *     Ficha de EPI em PDF (pdf-lib + qrcode, ver
 *     colaboradores/[id]/ficha/route.ts) consegue gerar um PDF de verdade,
 *     só que com dados fictícios, nunca persistidos — pega uma dependência
 *     quebrada ou uma regressão nessa cadeia sem precisar de um
 *     colaborador real.
 *
 * Autenticação: mesmo padrão do cron de inadimplência
 * (api/cron/verificar-inadimplencia/route.ts), mas com um token PRÓPRIO
 * (HEALTH_CHECK_TOKEN, variável de ambiente nova no Vercel) — não
 * reaproveita o CRON_SECRET de propósito: quem/o que chama esta rota
 * (hoje, uma rotina agendada fora do Vercel) não precisa, e não deveria,
 * conseguir também acionar o cron de inadimplência.
 */

function tokenValido(recebido: string | null, esperado: string): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type ResultadoChecagem = {
  ok: boolean;
  ms: number;
  erro?: string;
};

async function checarBancoDeDados(): Promise<ResultadoChecagem> {
  const inicio = Date.now();
  try {
    const admin = createAdminClient();
    // Só confirma que o banco responde e que a service role key ainda é
    // válida — não importa quantas linhas existem, por isso o limit(1).
    const { error } = await admin.from("empresas").select("id").limit(1);
    if (error) throw new Error(error.message);
    return { ok: true, ms: Date.now() - inicio };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - inicio,
      erro: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checarGeracaoDeFicha(): Promise<ResultadoChecagem> {
  const inicio = Date.now();
  try {
    const pdfDoc = await PDFDocument.create();
    const fonte = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pagina = pdfDoc.addPage([595, 300]);
    pagina.drawText("Verificação diária MorSafe — documento de teste", {
      x: 40,
      y: 250,
      size: 12,
      font: fonte,
    });

    // Mesma biblioteca/chamada usada pro QR code de verificação da ficha
    // real (ver criarVerificacaoDocumento + QRCode.toBuffer em
    // colaboradores/[id]/ficha/route.ts) — um link fictício, nunca gravado
    // em lugar nenhum.
    const qrBuffer = await QRCode.toBuffer(
      "https://morsafe.com.br/verificar/healthcheck",
      { margin: 1, width: 120 },
    );
    const qrImagem = await pdfDoc.embedPng(qrBuffer);
    pagina.drawImage(qrImagem, { x: 40, y: 100, width: 80, height: 80 });

    const bytes = await pdfDoc.save();
    if (bytes.byteLength === 0) {
      throw new Error("PDF gerado ficou vazio.");
    }
    return { ok: true, ms: Date.now() - inicio };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - inicio,
      erro: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(request: Request) {
  const segredoEsperado = process.env.HEALTH_CHECK_TOKEN;
  if (!segredoEsperado) {
    console.error(
      "Cron verificacao-diaria: HEALTH_CHECK_TOKEN não configurada no servidor.",
    );
    return new Response("Configuração do servidor incompleta.", {
      status: 500,
    });
  }

  // Aceita o token tanto no header Authorization (padrão de servidor pra
  // servidor, igual ao cron de inadimplência) quanto num parâmetro de URL
  // (?token=) — a rotina que dispara esta checagem hoje é um agente que só
  // tem uma ferramenta de busca na web genérica disponível, sem como
  // anexar um header customizado numa requisição. Query param é um pouco
  // menos ideal que header (pode acabar em log de acesso), mas aceitável
  // aqui: a rota é só leitura, não expõe dado nenhum de cliente, só um
  // "ok: true/false".
  const authHeader = request.headers.get("authorization");
  const tokenDoHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const tokenDaQuery = new URL(request.url).searchParams.get("token");
  const tokenRecebido = tokenDoHeader ?? tokenDaQuery;
  if (!tokenValido(tokenRecebido, segredoEsperado)) {
    console.error("Cron verificacao-diaria: token inválido ou ausente.");
    return new Response("Não autorizado.", { status: 401 });
  }

  const [database, geracaoFicha] = await Promise.all([
    checarBancoDeDados(),
    checarGeracaoDeFicha(),
  ]);

  const ok = database.ok && geracaoFicha.ok;

  return Response.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      checks: { database, geracaoFicha },
    },
    { status: ok ? 200 : 503 },
  );
}
