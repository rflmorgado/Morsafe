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
  y -= 28;

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

      page.drawText(`${TIPO_LABEL[evento.tipo]} — ${evento.epi}`, {
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
