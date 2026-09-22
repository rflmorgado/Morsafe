import { listColaboradoresParaExportar } from "@/lib/data/colaboradores";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { createClient } from "@/lib/supabase/server";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
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
 * Exporta a lista de colaboradores em CSV, respeitando os mesmos filtros
 * (busca, setor, status) aplicados na tela — não só a página atual, a lista
 * inteira que bate com o filtro. Usa ponto e vírgula como separador e BOM
 * UTF-8 porque é o que o Excel em português abre corretamente (vírgula é
 * separador decimal no Brasil, então o Excel BR espera ; nos CSVs).
 *
 * Exige papel "encarregado" ou superior: o CSV carrega CPF e telefone de
 * toda a empresa de uma vez, então um usuário "leitura" não pode gerar esse
 * arquivo, só consultar colaborador por colaborador na tela.
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
  const setor = searchParams.get("setor") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;
  const dir = searchParams.get("dir") ?? undefined;

  const colaboradores = await listColaboradoresParaExportar({
    query: q,
    setorId: setor,
    status,
    sort,
    dir,
  });

  const header = [
    "Nome",
    "Setor",
    "Cargo",
    "CPF",
    "Telefone",
    "Status",
    "Última entrega",
  ];

  const linhas = colaboradores.map((c) => [
    c.nome,
    c.setor,
    c.cargo,
    c.cpf ?? "",
    c.telefone ?? "",
    c.status === "ativo" ? "Ativo" : "Inativo",
    formatDate(c.ultimaEntrega),
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
      tabela: "colaboradores",
      registroId: user.empresaId,
      acao: "exportado",
      usuarioId: user.id,
      detalhes: { quantidade: colaboradores.length },
    });
  }

  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="colaboradores-${hoje}.csv"`,
    },
  });
}
