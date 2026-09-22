import { listEpisParaExportar } from "@/lib/data/epis";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Escapa um campo para CSV: se tiver ponto e vírgula, aspas ou quebra de
 * linha, envolve em aspas duplas (dobrando aspas internas), como manda o
 * padrão RFC 4180.
 */
function csvEscape(value: string) {
  if (/[";\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Exporta o catálogo de EPIs em CSV, respeitando os mesmos filtros (busca,
 * tipo, status) e a mesma ordenação aplicados na tela — a lista inteira que
 * bate com o filtro, não só a página atual. Ponto e vírgula como separador e
 * BOM UTF-8 pelo mesmo motivo do export de colaboradores: é o que o Excel em
 * português espera.
 *
 * Exige papel "encarregado" ou superior — mesmo nível de cadastrar/editar
 * EPI, já que não é uma ação mais sensível que essa.
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
  const q = searchParams.get("q") ?? undefined;
  const tipo = searchParams.get("tipo") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;
  const dir = searchParams.get("dir") ?? undefined;

  const epis = await listEpisParaExportar({ query: q, tipo, status, sort, dir });

  const header = [
    "EPI",
    "Tipo",
    "C.A.",
    "Exige C.A.",
    "Validade do C.A.",
    "Custo médio",
    "Fornecedor",
    "Vida útil (dias)",
    "Status",
  ];

  const linhas = epis.map((e) => [
    e.nome,
    e.tipo ?? "",
    e.ca ?? "",
    e.exigeCa ? "Sim" : "Não",
    formatDate(e.caValidade),
    formatMoney(e.custoMedioAtual),
    e.fornecedor ?? "",
    e.vidaUtilDias ?? "",
    e.ativo ? "Ativo" : "Inativo",
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
      tabela: "epis",
      registroId: user.empresaId,
      acao: "exportado",
      usuarioId: user.id,
      detalhes: { quantidade: epis.length },
    });
  }

  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="epis-${hoje}.csv"`,
    },
  });
}
