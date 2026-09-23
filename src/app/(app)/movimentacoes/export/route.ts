import {
  listMovimentacoesParaExportar,
  type TipoMovimentacao,
} from "@/lib/data/movimentacoes";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

const TIPO_LABEL: Record<TipoMovimentacao, string> = {
  entrega: "Entrega",
  devolucao: "Devolução",
  recusa: "Recusa",
};

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function isTipo(value: string | undefined): value is TipoMovimentacao {
  return value === "entrega" || value === "devolucao" || value === "recusa";
}

/**
 * Escapa um campo para CSV — mesmo padrão de epis/export e colaboradores/
 * export (RFC 4180).
 */
function csvEscape(value: string) {
  if (/[";\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Exporta o histórico de movimentações (entregas/devoluções/recusas) em
 * CSV, respeitando os mesmos filtros aplicados na tela — a lista inteira que
 * bate com o filtro, não só a página atual. Ponto e vírgula como separador e
 * BOM UTF-8, mesmo motivo dos outros exports: é o que o Excel em português
 * espera.
 *
 * Exige papel "encarregado" ou superior — mesmo nível de registrar uma
 * movimentação.
 */
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const tipoRaw = searchParams.get("tipo") ?? undefined;
  const tipo = isTipo(tipoRaw) ? tipoRaw : undefined;
  const colaboradorId = searchParams.get("colaborador") ?? undefined;
  const epiId = searchParams.get("epi") ?? undefined;
  const dataInicio = searchParams.get("de") ?? undefined;
  const dataFim = searchParams.get("ate") ?? undefined;

  const eventos = await listMovimentacoesParaExportar({
    tipo,
    colaboradorId,
    epiId,
    dataInicio,
    dataFim,
  });

  const header = [
    "Tipo",
    "Data",
    "Hora",
    "Colaborador",
    "EPI",
    "Quantidade",
    "C.A.",
    "Motivo",
    "Detalhe",
  ];

  const linhas = eventos.map((e) => [
    TIPO_LABEL[e.tipo],
    formatDate(e.data),
    e.hora ?? "",
    e.colaboradorNome,
    e.epiNome,
    e.quantidade ?? "",
    e.epiCa ?? "",
    e.motivoLabel,
    e.detalhe ?? "",
  ]);

  const csv = [header, ...linhas]
    .map((linha) => linha.map((v) => csvEscape(String(v))).join(";"))
    .join("\r\n");

  const bom = "﻿";
  const hoje = new Date().toISOString().slice(0, 10);

  if (user.empresaId) {
    await registrarLogAuditoria({
      supabase: await createClient(),
      empresaId: user.empresaId,
      tabela: "entregas",
      registroId: user.empresaId,
      acao: "exportado",
      usuarioId: user.id,
      detalhes: { quantidade: eventos.length },
    });
  }

  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="movimentacoes-${hoje}.csv"`,
    },
  });
}
