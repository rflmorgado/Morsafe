import { listItensParaReporEstoque } from "@/lib/data/estoque";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Escapa um campo para CSV: se tiver ponto e vírgula, aspas ou quebra de
 * linha, envolve em aspas duplas (dobrando aspas internas), como manda o
 * padrão RFC 4180. Mesma função de epis/export/route.ts e
 * colaboradores/export/route.ts, duplicada aqui de propósito (cada rota de
 * export fica autocontida, sem um módulo compartilhado só pra isso — mesma
 * convenção já adotada no resto do projeto).
 */
function csvEscape(value: string) {
  if (/[";\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Exporta em CSV a lista de "Itens para repor estoque" (ver
 * reposicao/page.tsx) — pedido do Rafael, 06/10/2026, pra levar pronto pra
 * solicitação de compra do mês seguinte. Ponto e vírgula como separador e
 * BOM UTF-8, mesmo motivo dos demais exports: é o que o Excel em português
 * espera.
 *
 * Exige papel "encarregado" ou superior — mesmo nível de exigido pra editar
 * o "Limite de alerta" (ver estoque/actions.ts), já que exportar é um passo
 * de quem vai de fato montar o pedido de compra.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Sessão expirada. Faça login novamente.", {
      status: 401,
    });
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return new Response("Seu perfil de acesso não permite exportar.", {
      status: 403,
    });
  }

  const itens = await listItensParaReporEstoque(user.empresaId);

  const header = [
    "EPI",
    "Tipo",
    "C.A.",
    "Saldo atual",
    "Limite de alerta",
    "Comprar",
    "Custo médio",
    "Custo estimado",
  ];

  const linhas = itens.map((i) => [
    i.nome,
    i.tipo ?? "",
    i.ca ?? "",
    i.saldoAtual,
    i.limiteAlerta,
    i.quantidadeComprar,
    formatMoney(i.custoMedioAtual),
    formatMoney(i.custoEstimado),
  ]);

  const custoTotalEstimado = itens.reduce((soma, i) => soma + i.custoEstimado, 0);
  linhas.push(["", "", "", "", "", "", "Total estimado", formatMoney(custoTotalEstimado)]);

  const csv = [header, ...linhas]
    .map((linha) => linha.map((v) => csvEscape(String(v))).join(";"))
    .join("\r\n");

  const bom = "\uFEFF";
  const hoje = new Date().toISOString().slice(0, 10);

  if (user.empresaId) {
    await registrarLogAuditoria({
      supabase: await createClient(),
      empresaId: user.empresaId,
      tabela: "estoque",
      registroId: user.empresaId,
      acao: "exportado",
      usuarioId: user.id,
      detalhes: { nome: "Itens para repor estoque", quantidade: itens.length },
    });
  }

  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reposicao-estoque-${hoje}.csv"`,
    },
  });
}
