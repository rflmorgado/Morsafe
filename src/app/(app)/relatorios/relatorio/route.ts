import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCurrentUser } from "@/lib/data/current-user";
import { getEmpresaAtual } from "@/lib/data/empresa";
import { createClient } from "@/lib/supabase/server";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";
import { apurarRelatorioConsumo } from "@/lib/data/relatorios";

// Teto de linhas listadas por seção — mesmo raciocínio do relatório de
// Auditoria NR-06 (ver MAX_ITENS_POR_GRUPO em auditoria/relatorio/route.ts):
// este é um resumo gerencial, não um extrato linha-a-linha (isso já existe
// em Movimentações). O excedente vira uma linha "+ N outro(s)".
const MAX_LINHAS_SETOR = 20;
const MAX_LINHAS_TIPO = 12;

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatDateTime(date: Date) {
  const opcoes = { timeZone: "America/Sao_Paulo" } as const;
  return `${date.toLocaleDateString("pt-BR", opcoes)} às ${date.toLocaleTimeString("pt-BR", {
    ...opcoes,
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function sanitizeFileName(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
}

/**
 * Relatório gerencial de consumo de EPI em PDF — a versão impressa/anexável
 * da tela de Relatórios (src/app/(app)/relatorios/page.tsx), pedido do
 * Rafael em 06/10/2026 ("Dashboard na tela + PDF"). Mesmo espírito do
 * relatório de Auditoria NR-06 (auditoria/relatorio/route.ts): reaproveita
 * os helpers de desenho (ensureSpace/drawWrappedText/fitSingleLine), o
 * mesmo cabeçalho com selo MorSafe + logo da empresa, e a mesma decisão de
 * não ter código de verificação/QR (não depende de uma tabela por
 * colaborador — é um retrato da empresa inteira num período).
 *
 * Acrescenta um helper novo (`drawRow`) pra desenhar linhas em colunas
 * (label/quantidade/valor) — o relatório de Auditoria não precisava disso,
 * só de listas de uma coluna só.
 */
export async function GET(request: Request) {
  const forcarDownload = new URL(request.url).searchParams.has("download");

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sessão expirada. Faça login novamente." },
      { status: 401 },
    );
  }
  if (!user.empresaId) {
    return NextResponse.json(
      { error: "Nenhuma empresa associada a este usuário." },
      { status: 400 },
    );
  }
  const empresaId = user.empresaId;

  const [r, empresa] = await Promise.all([
    apurarRelatorioConsumo(empresaId),
    getEmpresaAtual(empresaId),
  ]);

  // Best-effort — mesmo padrão de "relatorio_gerado" da Auditoria NR-06,
  // nunca bloqueia a emissão do PDF.
  await registrarLogAuditoria({
    supabase: await createClient(),
    empresaId,
    tabela: "entregas",
    registroId: empresaId,
    acao: "relatorio_consumo_gerado",
    usuarioId: user.id,
    detalhes: { totalQuantidade: r.totalQuantidade, totalValor: r.totalValor },
  });

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  let shieldImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  try {
    const shieldBytes = await fs.readFile(
      path.join(process.cwd(), "public/brand/shield.png"),
    );
    shieldImage = await pdfDoc.embedPng(shieldBytes);
  } catch (e) {
    console.error("relatorio-consumo: falha ao incorporar selo MorSafe:", e);
  }

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const marginX = 48;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 56;

  const brand = rgb(0.08, 0.31, 0.22);
  const textDark = rgb(0.12, 0.14, 0.13);
  const textM
