import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getColaboradorDetalhe } from "@/lib/data/colaboradores";
import { getCurrentUser } from "@/lib/data/current-user";

const TIPO_LABEL: Record<string, string> = {
  entrega: "Entrega",
  devolucao: "Devolução",
  recusa: "Recusa",
};

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function sanitizeFileName(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [colaborador, user] = await Promise.all([
    getColaboradorDetalhe(id),
    getCurrentUser(),
  ]);

  if (!colaborador) {
    return NextResponse.json(
      { error: "Colaborador não encontrado." },
      { status: 404 },
    );
  }

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const marginX = 48;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 56;

  const brand = rgb(0.08, 0.31, 0.22);
  const textDark = rgb(0.12, 0.14, 0.13);
  const textMuted = rgb(0.42, 0.46, 0.44);
  const lineColor = rgb(0.88, 0.91, 0.89);

  function ensureSpace(minHeight: number) {
    if (y - minHeight < 56) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 56;
    }
  }

  // pdf-lib não quebra linha automaticamente — quebra manual por largura.
  function drawWrappedText(
    text: string,
    opts: { size: number; font: typeof fontRegular; color: ReturnType<typeof rgb>; lineHeight: number; maxWidth: number },
  ) {
    const words = text.split(" ");
    let line = "";
    for (const word of words) {
      const tentative = line ? `${line} ${word}` : word;
      const width = opts.font.widthOfTextAtSize(tentative, opts.size);
      if (width > opts.maxWidth && line) {
        ensureSpace(opts.lineHeight + 10);
        page.drawText(line, { x: marginX, y, size: opts.size, font: opts.font, color: opts.color });
        y -= opts.lineHeight;
        line = word;
      } else {
        line = tentative;
      }
    }
    if (line) {
      ensureSpace(opts.lineHeight + 10);
      page.drawText(line, { x: marginX, y, size: opts.size, font: opts.font, color: opts.color });
      y -= opts.lineHeight;
    }
  }

  // Header
  page.drawText("Ficha de Entrega de EPI", {
    x: marginX,
    y,
    size: 18,
    font: fontBold,
    color: brand,
  });
  y -= 22;
  page.drawText(user?.empresaNome ?? "", {
    x: marginX,
    y,
    size: 10.5,
    font: fontRegular,
    color: textMuted,
  });
  y -= 28;

  page.drawLine({
    start: { x: marginX, y },
    end: { x: pageWidth - marginX, y },
    thickness: 1,
    color: lineColor,
  });
  y -= 24;

  // Colaborador info
  page.drawText(colaborador.nome, {
    x: marginX,
    y,
    size: 13.5,
    font: fontBold,
    color: textDark,
  });
  y -= 17;
  page.drawText(`${colaborador.setor} · ${colaborador.cargo}`, {
    x: marginX,
    y,
    size: 10.5,
    font: fontRegular,
    color: textMuted,
  });
  y -= 15;
  page.drawText(
    `Status: ${colaborador.status === "ativo" ? "Ativo" : "Inativo"}`,
    { x: marginX, y, size: 10.5, font: fontRegular, color: textMuted },
  );
  y -= 15;
  page.drawText(`Documento gerado em: ${formatDate(new Date().toISOString().slice(0, 10))}`, {
    x: marginX,
    y,
    size: 10.5,
    font: fontRegular,
    color: textMuted,
  });
  y -= 24;

  const empresaNomeDoc = user?.empresaNome ?? "a empresa";
  const termoResponsabilidade = `Declaro que recebi da empresa ${empresaNomeDoc} os Equipamentos de Proteção Individual (EPI) relacionados nesta ficha, destinados ao meu uso obrigatório, comprometendo-me a utilizá-los corretamente durante todo o período em que permanecerem ao meu dispor, observando as medidas gerais de disciplina e uso previstas na NR-06 – Equipamento de Proteção Individual, aprovada pela Portaria MTb nº 3.214, de 8 de junho de 1978. Declaro, ainda, estar ciente de que deverei devolvê-los à empresa no ato do meu desligamento, ou sempre que solicitado.`;

  ensureSpace(90);
  page.drawText("Termo de responsabilidade", {
    x: marginX,
    y,
    size: 11.5,
    font: fontBold,
    color: textDark,
  });
  y -= 17;
  drawWrappedText(termoResponsabilidade, {
    size: 10,
    font: fontRegular,
    color: textDark,
    lineHeight: 14,
    maxWidth: pageWidth - marginX * 2,
  });
  y -= 12;

  page.drawText("Histórico de entregas, devoluções e recusas", {
    x: marginX,
    y,
    size: 12,
    font: fontBold,
    color: textDark,
  });
  y -= 20;

  if (colaborador.eventos.length === 0) {
    page.drawText("Nenhum evento registrado.", {
      x: marginX,
      y,
      size: 11,
      font: fontRegular,
      color: textMuted,
    });
    y -= 20;
  } else {
    for (const evento of colaborador.eventos) {
      ensureSpace(46);

      const caLabel = evento.ca ? ` (CA ${evento.ca})` : "";
      page.drawText(`${TIPO_LABEL[evento.tipo]} — ${evento.epi}${caLabel}`, {
        x: marginX,
        y,
        size: 11,
        font: fontBold,
        color: textDark,
      });
      y -= 14;
      page.drawText(`${formatDate(evento.data)} · ${evento.detalhe}`, {
        x: marginX,
        y,
        size: 9.5,
        font: fontRegular,
        color: textMuted,
      });
      y -= 12;
      page.drawLine({
        start: { x: marginX, y },
        end: { x: pageWidth - marginX, y },
        thickness: 0.5,
        color: lineColor,
      });
      y -= 14;
    }
  }

  // Área de assinaturas — colaborador e responsável pela entrega (nem
  // sempre um técnico de segurança, por isso o rótulo genérico).
  ensureSpace(120);
  y -= 20;
  const colWidth = (pageWidth - marginX * 2 - 24) / 2;
  const col1X = marginX;
  const col2X = marginX + colWidth + 24;
  const signatureLineY = y;

  page.drawLine({
    start: { x: col1X, y: signatureLineY },
    end: { x: col1X + colWidth, y: signatureLineY },
    thickness: 0.8,
    color: textMuted,
  });
  page.drawLine({
    start: { x: col2X, y: signatureLineY },
    end: { x: col2X + colWidth, y: signatureLineY },
    thickness: 0.8,
    color: textMuted,
  });
  y -= 14;
  page.drawText("Assinatura do colaborador", {
    x: col1X,
    y,
    size: 9.5,
    font: fontBold,
    color: textDark,
  });
  page.drawText("Assinatura do responsável pela entrega", {
    x: col2X,
    y,
    size: 9.5,
    font: fontBold,
    color: textDark,
  });
  y -= 13;
  page.drawText(colaborador.nome, {
    x: col1X,
    y,
    size: 9,
    font: fontRegular,
    color: textMuted,
  });
  page.drawText("Nome: ____________________________", {
    x: col2X,
    y,
    size: 9,
    font: fontRegular,
    color: textMuted,
  });
  y -= 16;
  page.drawText("Data: ____ / ____ / ________", {
    x: col1X,
    y,
    size: 9,
    font: fontRegular,
    color: textMuted,
  });
  page.drawText("Data: ____ / ____ / ________", {
    x: col2X,
    y,
    size: 9,
    font: fontRegular,
    color: textMuted,
  });

  // Nota de conformidade — de onde vem o embasamento legal do modelo.
  y -= 26;
  ensureSpace(30);
  page.drawLine({
    start: { x: marginX, y },
    end: { x: pageWidth - marginX, y },
    thickness: 0.5,
    color: lineColor,
  });
  y -= 14;
  drawWrappedText(
    "O MorSafe verificou a legislação vigente para elaborar este modelo de ficha, com base na NR-06 – Equipamento de Proteção Individual (Portaria MTb nº 3.214, de 8 de junho de 1978), que estabelece a obrigatoriedade de registro da entrega de EPI ao colaborador.",
    {
      size: 8,
      font: fontRegular,
      color: textMuted,
      lineHeight: 11,
      maxWidth: pageWidth - marginX * 2,
    },
  );

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ficha-epi-${sanitizeFileName(
        colaborador.nome,
      )}.pdf"`,
    },
  });
}
