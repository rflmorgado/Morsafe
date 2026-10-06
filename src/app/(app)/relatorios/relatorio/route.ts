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
  const textMuted = rgb(0.42, 0.46, 0.44);
  const lineColor = rgb(0.88, 0.91, 0.89);
  const corAnomalo = rgb(0.75, 0.16, 0.16);

  function ensureSpace(minHeight: number) {
    if (y - minHeight < 56) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 56;
    }
  }

  function drawWrappedText(
    text: string,
    opts: {
      size: number;
      font: typeof fontRegular;
      color: ReturnType<typeof rgb>;
      lineHeight: number;
      maxWidth: number;
      x?: number;
    },
  ) {
    const x = opts.x ?? marginX;
    const words = text.split(" ");
    let line = "";
    for (const word of words) {
      const tentative = line ? `${line} ${word}` : word;
      const width = opts.font.widthOfTextAtSize(tentative, opts.size);
      if (width > opts.maxWidth && line) {
        ensureSpace(opts.lineHeight + 10);
        page.drawText(line, { x, y, size: opts.size, font: opts.font, color: opts.color });
        y -= opts.lineHeight;
        line = word;
      } else {
        line = tentative;
      }
    }
    if (line) {
      ensureSpace(opts.lineHeight + 10);
      page.drawText(line, { x, y, size: opts.size, font: opts.font, color: opts.color });
      y -= opts.lineHeight;
    }
  }

  function fitSingleLine(
    text: string,
    font: typeof fontRegular,
    size: number,
    maxWidth: number,
  ) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let truncado = text;
    while (
      truncado.length > 1 &&
      font.widthOfTextAtSize(`${truncado}…`, size) > maxWidth
    ) {
      truncado = truncado.slice(0, -1);
    }
    return `${truncado}…`;
  }

  function sectionTitle(text: string) {
    ensureSpace(36);
    y -= 8;
    page.drawText(text, { x: marginX, y, size: 13, font: fontBold, color: brand });
    y -= 10;
    page.drawLine({
      start: { x: marginX, y },
      end: { x: pageWidth - marginX, y },
      thickness: 0.75,
      color: lineColor,
    });
    y -= 18;
  }

  // Uma linha em colunas (label à esquerda, números à direita, alinhados
  // pela borda direita da própria coluna) — usado nas tabelas de mês e de
  // ranking. `cols` já vem na ordem de desenho; cada uma carrega sua
  // própria largura disponível, calculada no call-site (ver COLX_* abaixo).
  function drawRow(
    cols: {
      text: string;
      x: number;
      width: number;
      align?: "left" | "right";
      font?: typeof fontRegular;
      size?: number;
      color?: ReturnType<typeof rgb>;
    }[],
    rowHeight = 14,
  ) {
    ensureSpace(rowHeight);
    for (const col of cols) {
      const font = col.font ?? fontRegular;
      const size = col.size ?? 9.5;
      const color = col.color ?? textDark;
      const texto = fitSingleLine(col.text, font, size, col.width);
      const textWidth = font.widthOfTextAtSize(texto, size);
      const x = col.align === "right" ? col.x + col.width - textWidth : col.x;
      page.drawText(texto, { x, y, size, font, color });
    }
    y -= rowHeight;
  }

  // ---- Cabeçalho (selo MorSafe + logo da empresa, mesmo layout da Auditoria) ----
  const badgeR = 16;
  const badgeCenterX = pageWidth - marginX - badgeR;
  const badgeCenterY = pageHeight - 56 - 6;

  page.drawEllipse({
    x: badgeCenterX,
    y: badgeCenterY,
    xScale: badgeR,
    yScale: badgeR,
    color: brand,
  });

  if (shieldImage) {
    const shieldSize = badgeR * 1.15;
    page.drawImage(shieldImage, {
      x: badgeCenterX - shieldSize / 2,
      y: badgeCenterY - shieldSize / 2,
      width: shieldSize,
      height: shieldSize,
    });
  }

  const brandTextRightEdge = badgeCenterX - badgeR - 8;
  const wordmarkText = "MorSafe";
  const wordmarkSize = 11;
  const wordmarkWidth = fontBold.widthOfTextAtSize(wordmarkText, wordmarkSize);
  page.drawText(wordmarkText, {
    x: brandTextRightEdge - wordmarkWidth,
    y: badgeCenterY + 3,
    size: wordmarkSize,
    font: fontBold,
    color: brand,
  });

  const taglineText = "Protegendo pessoas. Comprovando conformidade.";
  const taglineSize = 7.5;
  const taglineWidth = fontOblique.widthOfTextAtSize(taglineText, taglineSize);
  page.drawText(taglineText, {
    x: brandTextRightEdge - taglineWidth,
    y: badgeCenterY - 9,
    size: taglineSize,
    font: fontOblique,
    color: textMuted,
  });

  const LOGO_MAX_LARGURA = 160;
  const LOGO_MAX_ALTURA = 40;
  const LOGO_GAP_ABAIXO = 30;

  const topoHeaderY = y;
  if (empresa?.logoUrl) {
    try {
      const base64 = empresa.logoUrl.split(",")[1] ?? "";
      const logoImagem = await pdfDoc.embedPng(Buffer.from(base64, "base64"));
      const escala = Math.min(
        LOGO_MAX_LARGURA / logoImagem.width,
        LOGO_MAX_ALTURA / logoImagem.height,
        1,
      );
      const logoLargura = logoImagem.width * escala;
      const logoAltura = logoImagem.height * escala;
      page.drawImage(logoImagem, {
        x: marginX,
        y: topoHeaderY - logoAltura,
        width: logoLargura,
        height: logoAltura,
      });
      y = topoHeaderY - LOGO_MAX_ALTURA - LOGO_GAP_ABAIXO;
    } catch (e) {
      console.error("relatorio-consumo: falha ao incorporar logo da empresa:", e);
    }
  }

  page.drawText("Relatório de Consumo de EPI", {
    x: marginX,
    y,
    size: 18,
    font: fontBold,
    color: brand,
  });
  y -= 22;
  page.drawText(empresa?.nome ?? user.empresaNome ?? "", {
    x: marginX,
    y,
    size: 10.5,
    font: fontRegular,
    color: textMuted,
  });
  y -= 15;
  page.drawText(
    `Período: ${r.janela.inicioLabel} a ${r.janela.fimLabel} (últimos ${r.janela.meses} meses) · Gerado em ${formatDateTime(new Date())} por ${user.nome}`,
    { x: marginX, y, size: 9.5, font: fontRegular, color: textMuted },
  );
  y -= 24;

  page.drawLine({
    start: { x: marginX, y },
    end: { x: pageWidth - marginX, y },
    thickness: 1,
    color: lineColor,
  });
  y -= 22;

  // ---- Resumo ----
  sectionTitle("Resumo");
  const linhasResumo = [
    `Entregas no período: ${r.totalQuantidade} unidade${r.totalQuantidade === 1 ? "" : "s"}`,
    `Gasto no período: ${formatMoney(r.totalValor)}`,
    `Variação vs. mês anterior: ${
      r.comparativoMes.variacaoQuantidade === null
        ? "sem referência"
        : `${r.comparativoMes.variacaoQuantidade >= 0 ? "+" : ""}${r.comparativoMes.variacaoQuantidade}% em quantidade`
    }`,
    `Variação vs. 12 meses anteriores: ${
      r.comparativoAno.variacaoQuantidade === null
        ? "sem referência"
        : `${r.comparativoAno.variacaoQuantidade >= 0 ? "+" : ""}${r.comparativoAno.variacaoQuantidade}% em quantidade, ${
            r.comparativoAno.variacaoValor === null
              ? "sem referência em valor"
              : `${r.comparativoAno.variacaoValor >= 0 ? "+" : ""}${r.comparativoAno.variacaoValor}% em valor`
          }`
    }`,
  ];
  for (const linha of linhasResumo) {
    ensureSpace(16);
    page.drawText(linha, { x: marginX, y, size: 10.5, font: fontBold, color: textDark });
    y -= 15;
  }
  y -= 10;

  // ---- Consumo mensal ----
  sectionTitle("Consumo mensal");
  const COLX_MES = marginX;
  const COLW_MES = 120;
  const COLX_QTD = COLX_MES + COLW_MES;
  const COLW_QTD = 120;
  const COLX_VALOR = COLX_QTD + COLW_QTD;
  const COLW_VALOR = pageWidth - marginX - COLX_VALOR;

  drawRow([
    { text: "Mês", x: COLX_MES, width: COLW_MES, font: fontBold, color: textMuted },
    {
      text: "Quantidade",
      x: COLX_QTD,
      width: COLW_QTD,
      align: "right",
      font: fontBold,
      color: textMuted,
    },
    {
      text: "Gasto",
      x: COLX_VALOR,
      width: COLW_VALOR,
      align: "right",
      font: fontBold,
      color: textMuted,
    },
  ]);
  y -= 4;
  for (const m of r.porMes) {
    drawRow([
      { text: m.label, x: COLX_MES, width: COLW_MES },
      { text: String(m.quantidade), x: COLX_QTD, width: COLW_QTD, align: "right" },
      { text: formatMoney(m.valor), x: COLX_VALOR, width: COLW_VALOR, align: "right" },
    ]);
  }
  y -= 10;

  // ---- Setor com maior consumo ----
  sectionTitle("Setor com maior consumo");
  if (r.porSetor.length === 0) {
    ensureSpace(18);
    page.drawText("Nenhuma entrega registrada no período.", {
      x: marginX,
      y,
      size: 10.5,
      font: fontRegular,
      color: textMuted,
    });
    y -= 18;
  } else {
    drawRow([
      { text: "Setor", x: COLX_MES, width: COLW_MES + 60, font: fontBold, color: textMuted },
      {
        text: "Unidades",
        x: COLX_MES + 60 + COLW_MES,
        width: 70,
        align: "right",
        font: fontBold,
        color: textMuted,
      },
      {
        text: "Gasto",
        x: COLX_MES + 130 + COLW_MES,
        width: pageWidth - marginX - (COLX_MES + 130 + COLW_MES),
        align: "right",
        font: fontBold,
        color: textMuted,
      },
    ]);
    y -= 4;
    const setoresExibidos = r.porSetor.slice(0, MAX_LINHAS_SETOR);
    for (const s of setoresExibidos) {
      drawRow([
        {
          text: `${s.setorNome} (${s.unidadeNome})`,
          x: COLX_MES,
          width: COLW_MES + 60,
        },
        { text: String(s.quantidade), x: COLX_MES + 60 + COLW_MES, width: 70, align: "right" },
        {
          text: formatMoney(s.valor),
          x: COLX_MES + 130 + COLW_MES,
          width: pageWidth - marginX - (COLX_MES + 130 + COLW_MES),
          align: "right",
        },
      ]);
    }
    if (r.porSetor.length > MAX_LINHAS_SETOR) {
      ensureSpace(13);
      page.drawText(
        `+ ${r.porSetor.length - MAX_LINHAS_SETOR} outro(s) — ver a tela de Relatórios no sistema.`,
        { x: marginX, y, size: 8.5, font: fontOblique, color: textMuted },
      );
      y -= 12;
    }
  }
  y -= 10;

  // ---- Por unidade ----
  if (r.porUnidade.length > 1) {
    sectionTitle("Consumo por unidade");
    for (const u of r.porUnidade) {
      const pct =
        r.totalValor > 0 ? Math.round((u.valor / r.totalValor) * 100) : 0;
      ensureSpace(13);
      page.drawText(
        `${u.unidadeNome}: ${u.quantidade} un. · ${formatMoney(u.valor)} (${pct}%)`,
        { x: marginX, y, size: 10, font: fontRegular, color: textDark },
      );
      y -= 15;
    }
    y -= 6;
  }

  // ---- Saídas por tipo de EPI ----
  sectionTitle("Saídas por tipo de EPI");
  if (r.porTipoEpi.length === 0) {
    ensureSpace(18);
    page.drawText("Nenhuma entrega registrada no período.", {
      x: marginX,
      y,
      size: 10.5,
      font: fontRegular,
      color: textMuted,
    });
    y -= 18;
  } else {
    for (const t of r.porTipoEpi.slice(0, MAX_LINHAS_TIPO)) {
      ensureSpace(13);
      const linha = fitSingleLine(
        `•  ${t.tipo} — ${t.quantidade} un. · ${formatMoney(t.valor)}`,
        fontRegular,
        9.5,
        pageWidth - marginX * 2 - 8,
      );
      page.drawText(linha, { x: marginX + 8, y, size: 9.5, font: fontRegular, color: textDark });
      y -= 13;
    }
    if (r.porTipoEpi.length > MAX_LINHAS_TIPO) {
      ensureSpace(13);
      page.drawText(
        `+ ${r.porTipoEpi.length - MAX_LINHAS_TIPO} outro(s).`,
        { x: marginX + 8, y, size: 8.5, font: fontOblique, color: textMuted },
      );
      y -= 12;
    }
  }
  y -= 10;

  // ---- Entradas por tipo de EPI ----
  sectionTitle("Entradas de estoque por tipo de EPI");
  if (r.entradasPorTipo.length === 0) {
    ensureSpace(18);
    page.drawText("Nenhuma entrada de estoque registrada no período.", {
      x: marginX,
      y,
      size: 10.5,
      font: fontRegular,
      color: textMuted,
    });
    y -= 18;
  } else {
    ensureSpace(16);
    page.drawText(
      `Total comprado: ${r.entradasTotal.quantidade} un. · ${formatMoney(r.entradasTotal.valor)}`,
      { x: marginX, y, size: 10, font: fontBold, color: textDark },
    );
    y -= 17;
    for (const t of r.entradasPorTipo.slice(0, MAX_LINHAS_TIPO)) {
      ensureSpace(13);
      const linha = fitSingleLine(
        `•  ${t.tipo} — ${t.quantidade} un. · ${formatMoney(t.valor)}`,
        fontRegular,
        9.5,
        pageWidth - marginX * 2 - 8,
      );
      page.drawText(linha, { x: marginX + 8, y, size: 9.5, font: fontRegular, color: textDark });
      y -= 13;
    }
    if (r.entradasPorTipo.length > MAX_LINHAS_TIPO) {
      ensureSpace(13);
      page.drawText(
        `+ ${r.entradasPorTipo.length - MAX_LINHAS_TIPO} outro(s).`,
        { x: marginX + 8, y, size: 8.5, font: fontOblique, color: textMuted },
      );
      y -= 12;
    }
  }
  y -= 10;

  // ---- Motivo das entregas ----
  sectionTitle("Motivo das entregas");
  if (r.porMotivo.length === 0) {
    ensureSpace(18);
    page.drawText("Nenhuma entrega registrada no período.", {
      x: marginX,
      y,
      size: 10.5,
      font: fontRegular,
      color: textMuted,
    });
    y -= 18;
  } else {
    if (r.consumoAnomalo.quantidade > 0) {
      drawWrappedText(
        `${r.consumoAnomalo.quantidade} entrega(s) (${r.consumoAnomalo.pct}% do período, ${formatMoney(r.consumoAnomalo.valor)}) tiveram como motivo dano, perda ou roubo — reposição que não é desgaste natural e vale investigar.`,
        {
          size: 9.5,
          font: fontBold,
          color: corAnomalo,
          lineHeight: 13,
          maxWidth: pageWidth - marginX * 2,
        },
      );
      y -= 6;
    }
    const MOTIVOS_ANOMALOS = new Set(["troca_dano", "perda", "roubo"]);
    for (const m of r.porMotivo) {
      ensureSpace(13);
      page.drawText(`•  ${m.label} — ${m.quantidade} (${m.pct}%)`, {
        x: marginX + 8,
        y,
        size: 9.5,
        font: fontRegular,
        color: MOTIVOS_ANOMALOS.has(m.motivo) ? corAnomalo : textDark,
      });
      y -= 13;
    }
  }
  y -= 8;

  // ---- Nota de abrangência ----
  ensureSpace(60);
  page.drawLine({
    start: { x: marginX, y },
    end: { x: pageWidth - marginX, y },
    thickness: 0.5,
    color: lineColor,
  });
  y -= 14;
  drawWrappedText(
    "Este relatório reflete as entregas e entradas de estoque registradas no sistema MorSafe no período indicado — não substitui a conferência física do estoque nem considera movimentações feitas fora do sistema.",
    {
      size: 8,
      font: fontRegular,
      color: textMuted,
      lineHeight: 11,
      maxWidth: pageWidth - marginX * 2,
    },
  );

  const pdfBytes = await pdfDoc.save();
  const hojeArquivo = new Date().toISOString().slice(0, 10);

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${forcarDownload ? "attachment" : "inline"}; filename="relatorio-consumo-epi-${sanitizeFileName(
        empresa?.nome ?? user.empresaNome ?? "empresa",
      )}-${hojeArquivo}.pdf"`,
    },
  });
}
