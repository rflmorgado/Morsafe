import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

/**
 * Régua de inadimplência (ver "MorSafe_Modelo_Comercial_e_Fluxo_de_
 * Cobranca.docx", seção 7: "Após o período definido: suspensão do
 * acesso operacional"). O documento não define quantos dias é esse
 * período — GRACE_DIAS abaixo é uma decisão tomada aqui, documentada,
 * não um número do documento. 10 dias corridos após o vencimento dá
 * tempo de o cliente regularizar (ex: boleto que demora a compensar)
 * sem deixar a empresa inadimplente operando indefinidamente. Fácil de
 * ajustar depois — é só esse número, num lugar só.
 *
 * Só promove de "inadimplente" pra "suspensa" (nunca de "pendente" ou
 * "ativa" direto pra "suspensa" — isso exigiria primeiro passar por
 * inadimplente, que já é setado pelo webhook em PAYMENT_OVERDUE). Essa
 * é a ÚNICA rotina do sistema que grava "suspensa" — o webhook
 * (src/app/api/webhooks/asaas/route.ts) nunca pula direto pra lá, de
 * propósito (ver comentário lá).
 *
 * Configurar no Vercel (Project Settings > Cron Jobs, ou via
 * vercel.json na raiz do projeto):
 *   { "path": "/api/cron/verificar-inadimplencia", "schedule": "0 10 * * *" }
 * (10:00 UTC = 07:00 em São Paulo, antes do expediente — roda 1x/dia,
 * limite do plano Hobby do Vercel pra cron jobs).
 *
 * Autenticação: a Vercel injeta automaticamente o header
 * "Authorization: Bearer <CRON_SECRET>" em chamadas de cron job quando
 * a variável de ambiente CRON_SECRET existe no projeto — configurar
 * essa variável no Vercel é o que protege esta rota de ser chamada por
 * qualquer um que descubra a URL (sem isso, qualquer pessoa poderia
 * bater nesse endpoint e forçar a checagem fora de hora — não é
 * destrutivo, mas não deveria ser público mesmo assim).
 */

const GRACE_DIAS = 10;

function tokenValido(recebido: string | null, esperado: string): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const segredoEsperado = process.env.CRON_SECRET;
  if (!segredoEsperado) {
    console.error(
      "Cron verificar-inadimplencia: CRON_SECRET não configurada no servidor.",
    );
    return new Response("Configuração do servidor incompleta.", {
      status: 500,
    });
  }

  const authHeader = request.headers.get("authorization");
  const tokenRecebido = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!tokenValido(tokenRecebido, segredoEsperado)) {
    console.error("Cron verificar-inadimplencia: token inválido ou ausente.");
    return new Response("Não autorizado.", { status: 401 });
  }

  const admin = createAdminClient();

  const hoje = new Date();
  const dataLimite = new Date(hoje);
  dataLimite.setDate(dataLimite.getDate() - GRACE_DIAS);
  const dataLimiteStr = dataLimite.toISOString().slice(0, 10); // YYYY-MM-DD

  // Toda assinatura inadimplente cujo vencimento já passou do prazo de
  // tolerância — junta com empresas só pra pegar o nome (log de
  // auditoria e, no caso de erro, diagnóstico mais fácil nos logs do
  // servidor).
  const { data: candidatas, error: buscaError } = await admin
    .from("assinaturas")
    .select("id, empresa_id, proximo_vencimento, empresas ( nome )")
    .eq("status", "inadimplente")
    .not("proximo_vencimento", "is", null)
    .lte("proximo_vencimento", dataLimiteStr);

  if (buscaError) {
    console.error(
      "Cron verificar-inadimplencia: falha ao buscar candidatas:",
      buscaError.message,
    );
    return new Response("Erro ao buscar assinaturas.", { status: 500 });
  }

  if (!candidatas || candidatas.length === 0) {
    return new Response("OK (nenhuma assinatura a suspender)", {
      status: 200,
    });
  }

  let suspensas = 0;
  for (const assinatura of candidatas) {
    const agora = new Date().toISOString();
    const { error: updateError } = await admin
      .from("assinaturas")
      .update({ status: "suspensa", suspensa_em: agora, atualizado_em: agora })
      .eq("id", assinatura.id)
      // Reconfirma a condição no próprio UPDATE (não só na busca acima)
      // — evita suspender de novo (e regravar suspensa_em) uma
      // assinatura que, entre a busca e aqui, já tenha sido paga e
      // voltado pra "ativa" via webhook, já que este loop não é
      // instantâneo e o webhook roda em paralelo.
      .eq("status", "inadimplente");

    if (updateError) {
      console.error(
        `Cron verificar-inadimplencia: falha ao suspender assinatura ${assinatura.id}:`,
        updateError.message,
      );
      continue; // segue tentando as outras — um erro isolado não deve travar o lote
    }

    suspensas += 1;

    const vencimento = assinatura.proximo_vencimento
      ? new Date(assinatura.proximo_vencimento)
      : null;
    const diasAtraso = vencimento
      ? Math.round((hoje.getTime() - vencimento.getTime()) / 86_400_000)
      : undefined;

    // Ação do sistema, não de uma pessoa logada — usuarioId null (ver
    // registrarLogAuditoria: aceita null, o histórico por usuário
    // simplesmente nunca lista essas linhas, só o histórico por
    // empresa).
    await registrarLogAuditoria({
      supabase: admin,
      empresaId: assinatura.empresa_id,
      tabela: "assinaturas",
      registroId: assinatura.id,
      acao: "assinatura_suspensa",
      usuarioId: null,
      detalhes: {
        nome: (assinatura.empresas as { nome: string } | null)?.nome ?? null,
        diasAtraso,
      },
    });
  }

  return new Response(
    `OK (${suspensas} de ${candidatas.length} assinatura(s) suspensa(s))`,
    { status: 200 },
  );
}
