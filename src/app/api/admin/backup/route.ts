import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Backup de emergência — rota temporária, criada em 08/10/2026 enquanto o
 * acesso ao painel do Supabase está bloqueado (chamado de suporte em
 * aberto desde 28/09/2026, sem resposta). Não depende do painel nem do
 * SQL Editor: usa a mesma SUPABASE_SERVICE_ROLE_KEY que o app já usa em
 * produção (ver lib/supabase/admin.ts), que continua funcionando
 * normalmente mesmo com o painel bloqueado — são credenciais diferentes.
 *
 * Gera um JSON com o conteúdo ATUAL de toda tabela de dado real do
 * MorSafe (histórico de entregas/devoluções/recusas incluído — é
 * exatamente o dado de conformidade NR-06 que mais importa proteger, ver
 * CLAUDE.md). Tabelas que ainda não existem em produção (migração
 * pendente, ver morsafe-pendentes-supabase-TUDO.sql) são puladas e
 * listadas em "tabelasAusentes", sem quebrar o backup das demais —
 * mesmo código de erro PGRST205 (tabela não encontrada no schema cache)
 * já usado em excluirEmpresaPermanentemente, empresas/actions.ts.
 *
 * Protegida por BACKUP_SECRET — variável de ambiente NOVA, exclusiva
 * desta rota (não reaproveita o CRON_SECRET, cujo valor atual não está
 * disponível pra consulta no Vercel depois de salvo como "Secret").
 * Aceita tanto no header Authorization quanto por ?token= na própria
 * URL, pra dar pra acessar direto pelo navegador, sem precisar de
 * ferramenta nenhuma além dele. IMPORTANTE: remover esta rota (ou pelo
 * menos apagar a variável BACKUP_SECRET) assim que o acesso ao Supabase
 * for restaurado — ela expõe uma cópia de todo o histórico de EPI de
 * todas as empresas de uma vez, algo que nenhuma outra rota do sistema
 * faz.
 */

const TABELAS = [
  "empresas",
  "usuarios",
  "unidades",
  "setores",
  "cargos",
  "colaboradores",
  "epis",
  "setor_epi",
  "estoque",
  "entradas_estoque",
  "entregas",
  "devolucoes",
  "recusas",
  "log_auditoria",
  "verificacoes_documento",
  "estacoes_assinatura",
  "assinaturas",
  "asaas_webhook_events",
  "pagamentos_empresa",
  "solicitacoes_assinatura",
] as const;

function tokenValido(recebido: string | null, esperado: string): boolean {
  if (!recebido) return false;
  const bufRecebido = Buffer.from(recebido);
  const bufEsperado = Buffer.from(esperado);
  if (bufRecebido.length !== bufEsperado.length) return false;
  return timingSafeEqual(bufRecebido, bufEsperado);
}

export async function GET(request: Request) {
  const esperado = process.env.BACKUP_SECRET;
  if (!esperado) {
    return Response.json(
      { error: "BACKUP_SECRET não configurado no Vercel." },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const tokenHeader = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "") ?? null;
  const tokenQuery = url.searchParams.get("token");
  const recebido = tokenHeader ?? tokenQuery;

  if (!tokenValido(recebido, esperado)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();

  const resultado: Record<string, unknown[]> = {};
  const tabelasAusentes: string[] = [];
  const erros: Record<string, string> = {};

  for (const tabela of TABELAS) {
    const { data, error } = await admin.from(tabela).select("*");

    if (error) {
      // 42P01 = Postgres "tabela não existe"; PGRST205 = o PostgREST não
      // achou a tabela no schema cache dele — mesmo raciocínio do
      // PGRST204 (coluna ausente) usado em várias outras rotas deste
      // projeto, aplicado aqui a tabela inteira. Ambos os casos: migração
      // ainda pendente, não é erro de verdade.
      if (error.code === "42P01" || error.code === "PGRST205") {
        tabelasAusentes.push(tabela);
        continue;
      }
      erros[tabela] = error.message;
      continue;
    }

    resultado[tabela] = data ?? [];
  }

  const corpo = {
    geradoEm: new Date().toISOString(),
    tabelas: resultado,
    tabelasAusentes,
    erros,
  };

  return new Response(JSON.stringify(corpo, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="morsafe-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    },
  });
}
