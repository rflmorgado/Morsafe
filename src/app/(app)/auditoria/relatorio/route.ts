import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCurrentUser } from "@/lib/data/current-user";
import { getEmpresaAtual } from "@/lib/data/empresa";
import { createClient } from "@/lib/supabase/server";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";
import {
  apurarAuditoriaRegistros,
  type RaioXStatus,
} from "@/lib/data/auditoria-registros";
import {
  listSetoresComStatusAuditoria,
  calcularSituacaoAuditoriaSetor,
  REVISAO_AUDITORIA_MESES,
} from "@/lib/data/auditorias-nr06";
import { contarNaoConformidades } from "@/lib/data/auditorias-nr06-perguntas";

const STATUS_LABEL: Record<RaioXStatus, string> = {
  ok: "Controlado",
  atencao: "Atenção",
  critico: "Crítico",
};

const SEVERIDADE_LABEL: Record<"critico" | "atencao", string> = {
  critico: "Crítico",
  atencao: "Atenção",
};

// Teto de itens listados por grupo de pendência e de setores listados no
// checklist de campo — sem isso, uma empresa grande (centenas de
// colaboradores/setores) geraria um PDF de dezenas de páginas só de listas.
// O relatório é um DIAGNÓSTICO resumido; o detalhe completo de cada item
// continua disponível nas abas Pendências/Checklist/Colaboradores/EPIs do
// próprio sistema — por isso o excedente vira uma linha "+ N outro(s)" em
// vez de ser omitido sem aviso.
const MAX_ITENS_POR_GRUPO = 25;
const MAX_SETORES_LISTADOS = 60;

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
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
 * Relatório de Auditoria NR-06 em PDF — o "diagnóstico" que a aba Relatório
 * prometia desde que a tela de Auditoria ganhou abas (06/10/2026, ver
 * comentário em auditoria/page.tsx). Reúne, num único documento, o mesmo
 * diagnóstico já mostrado nas abas Visão geral, Pendências e Checklist de
 * campo — pensado pra ser anexado a uma fiscalização ou guardado como
 * evidência do estado dos controles numa data específica.
 *
 * Deliberadamente SEM código de verificação/QR (diferente da ficha de EPI,
 * ver colaboradores/[id]/ficha/route.ts): aquele mecanismo grava em
 * `verificacoes_documento`, tabela cujas colunas de colaborador são
 * obrigatórias — esse relatório não é sobre um colaborador específico, é
 * um retrato da empresa inteira. Criar uma dependência de schema nova pra
 * isso teria que esperar uma migração que o Rafael não tem como aplicar
 * (ver CLAUDE.md sobre o acesso ao Supabase bloqueado) — melhor manter este
 * primeiro relatório autocontido e sem essa dependência.
 *
 * Deliberadamente SEM detalhe linha-a-linha de cada colaborador/EPI: isso já
 * existe nas próprias abas (e na ficha individual de cada colaborador) — um
 * relatório de diagnóstico que tentasse repetir tudo isso ficaria com
 * centenas de páginas em empresas maiores e perderia o propósito de ser um
 * resumo rápido de "como estão os controles hoje".
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

  const [apuracao, setoresChecklist, empresa] = await Promise.all([
    apurarAuditoriaRegistros(empresaId),
    listSetoresComStatusAuditoria(empresaId),
    getEmpresaAtual(empresaId),
  ]);

  // Best-effort (nunca bloqueia a emissão do relatório, ver registrarLogAuditoria) —
  // fica registrado quem gerou o relatório e quando, igual ao "baixou_ficha".
  await registrarLogAuditoria({
    supabase: await createClient(),
    empresaId,
    tabela: "auditorias_nr06",
    registroId: empresaId,
    acao: "relatorio_gerado",
    usuarioId: user.id,
    detalhes: { indiceControle: apuracao.indiceControle },
  });

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Selo MorSafe — ver comentário equivalente em colaboradores/[id]/ficha/route.ts
  // (try/catch pra nunca travar a emissão do documento por causa disso).
  let shieldImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  try {
    const shieldBytes = await fs.readFile(
      path.join(process.cwd(), "public/brand/shield.png"),
    );
    shieldImage = await pdfDoc.embedPng(shieldBytes);
  } catch (e) {
    console.error("relatorio: falha ao incorporar selo MorSafe:", e);
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
  const corOk = rgb(0.09, 0.55, 0.34);
  const corAtencao = rgb(0.72, 0.5, 0.06);
  const corCritico = rgb(0.75, 0.16, 0.16);

  function corStatus(status: RaioXStatus) {
    if (status === "ok") return corOk;
    if (status === "atencao") return corAtencao;
    return corCritico;
  }

  function ensureSpace(minHeight: number) {
    if (y - minHeight < 56) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 56;
    }
  }

  // pdf-lib não quebra linha automaticamente — quebra manual por largura.
  // `x` é configurável (diferente da versão em ficha/route.ts) porque este
  // relatório indenta o texto de detalhe de cada item do Raio-X.
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

  // Corta com "…" em vez de quebrar — usado nas linhas de lista (pendências,
  // setores), uma por registro, pra caber muito mais itens por página.
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

  // ---- Cabeçalho (selo MorSafe + logo da empresa, mesmo layout da ficha) ----
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
      console.error("relatorio: falha ao incorporar logo da empresa:", e);
    }
  }

  page.drawText("Relatório de Auditoria NR-06", {
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
  page.drawText(`Gerado em ${formatDateTime(new Date())} por ${user.nome}`, {
    x: marginX,
    y,
    size: 9.5,
    font: fontRegular,
    color: textMuted,
  });
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
    `Índice de controle dos registros: ${apuracao.indiceControle}%`,
    `Registros analisados: ${apuracao.registrosAnalisados}`,
    `Sem pendência: ${apuracao.semPendencia}`,
    `Atenção: ${apuracao.atencaoTotal}`,
    `Críticos: ${apuracao.criticoTotal}`,
  ];
  for (const linha of linhasResumo) {
    ensureSpace(16);
    page.drawText(linha, { x: marginX, y, size: 10.5, font: fontBold, color: textDark });
    y -= 15;
  }

  if (apuracao.avisos.length > 0) {
    y -= 4;
    drawWrappedText(
      `Atenção: alguns dados não puderam ser carregados ao gerar este relatório (${apuracao.avisos.join("; ")}). Os números acima podem estar incompletos.`,
      {
        size: 8.5,
        font: fontOblique,
        color: corAtencao,
        lineHeight: 11,
        maxWidth: pageWidth - marginX * 2,
      },
    );
  }
  y -= 10;

  // ---- Raio-X dos controles ----
  sectionTitle("Raio-X dos controles relacionados à NR-06");
  for (const item of apuracao.raioX) {
    ensureSpace(34);
    const dotY = y - 3.5;
    page.drawEllipse({
      x: marginX + 3,
      y: dotY,
      xScale: 3,
      yScale: 3,
      color: corStatus(item.status),
    });
    const textX = marginX + 12;
    page.drawText(`${item.label} — ${STATUS_LABEL[item.status]}`, {
      x: textX,
      y,
      size: 10.5,
      font: fontBold,
      color: textDark,
    });
    y -= 13;
    drawWrappedText(item.detalhe, {
      size: 9,
      font: fontRegular,
      color: textMuted,
      lineHeight: 12,
      maxWidth: pageWidth - marginX * 2 - 12,
      x: textX,
    });
    y -= 6;
  }

  // ---- Pendências ----
  sectionTitle("Pendências identificadas");
  if (apuracao.pendencias.length === 0) {
    ensureSpace(18);
    page.drawText("Nenhuma pendência encontrada nos registros analisados.", {
      x: marginX,
      y,
      size: 10.5,
      font: fontRegular,
      color: textMuted,
    });
    y -= 18;
  } else {
    for (const grupo of apuracao.pendencias) {
      ensureSpace(40);
      const corSeveridade =
        grupo.severidade === "critico" ? corCritico : corAtencao;
      page.drawText(
        `${grupo.titulo} (${SEVERIDADE_LABEL[grupo.severidade]} · ${grupo.itens.length})`,
        { x: marginX, y, size: 11, font: fontBold, color: corSeveridade },
      );
      y -= 14;
      drawWrappedText(grupo.descricao, {
        size: 9,
        font: fontRegular,
        color: textMuted,
        lineHeight: 12,
        maxWidth: pageWidth - marginX * 2,
      });
      y -= 4;

      const itensExibidos = grupo.itens.slice(0, MAX_ITENS_POR_GRUPO);
      for (const item of itensExibidos) {
        ensureSpace(13);
        const linha = fitSingleLine(
          `•  ${item.titulo}`,
          fontRegular,
          9,
          pageWidth - marginX * 2 - 8,
        );
        page.drawText(linha, {
          x: marginX + 8,
          y,
          size: 9,
          font: fontRegular,
          color: textDark,
        });
        y -= 12;
      }
      if (grupo.itens.length > MAX_ITENS_POR_GRUPO) {
        ensureSpace(13);
        page.drawText(
          `+ ${grupo.itens.length - MAX_ITENS_POR_GRUPO} outro(s) — ver aba Pendências no sistema.`,
          { x: marginX + 8, y, size: 8.5, font: fontOblique, color: textMuted },
        );
        y -= 12;
      }
      y -= 10;
    }
  }

  // ---- Checklist de campo por setor ----
  sectionTitle("Checklist de campo por setor");
  const totalSetores = setoresChecklist.length;
  // 4 estados (ver calcularSituacaoAuditoriaSetor, em lib/data/auditorias-
  // nr06.ts): "pendente" (não-conformidade encontrada) é sempre o mais
  // urgente, independente da data; "vencida" é um setor já conforme, mas
  // cuja última auditoria passou do prazo de revisão de
  // REVISAO_AUDITORIA_MESES — mesma lógica usada na aba Checklist de campo
  // (checklist-campo-tab.tsx), centralizada pra nunca divergir entre as
  // duas telas.
  const nuncaAuditados = setoresChecklist.filter(
    (s) => calcularSituacaoAuditoriaSetor(s.ultimaAuditoria) === "nunca_auditado",
  ).length;
  const comPendencia = setoresChecklist.filter(
    (s) => calcularSituacaoAuditoriaSetor(s.ultimaAuditoria) === "pendente",
  ).length;
  const vencidas = setoresChecklist.filter(
    (s) => calcularSituacaoAuditoriaSetor(s.ultimaAuditoria) === "vencida",
  ).length;
  const conformes = totalSetores - nuncaAuditados - comPendencia - vencidas;

  if (totalSetores === 0) {
    ensureSpace(18);
    page.drawText("Nenhum setor cadastrado.", {
      x: marginX,
      y,
      size: 10.5,
      font: fontRegular,
      color: textMuted,
    });
    y -= 18;
  } else {
    drawWrappedText(
      `Setores com a última auditoria há mais de ${REVISAO_AUDITORIA_MESES} meses aparecem como "Auditoria vencida" — a NR-06 não fixa prazo pra esse checklist; ${REVISAO_AUDITORIA_MESES} meses é o ciclo mínimo de revisão do PGR (NR-01), usado aqui como referência. Nada impede rodar a auditoria antes disso.`,
      {
        size: 8.5,
        font: fontOblique,
        color: textMuted,
        lineHeight: 11,
        maxWidth: pageWidth - marginX * 2,
      },
    );
    y -= 6;
    ensureSpace(16);
    page.drawText(
      `${conformes} conforme(s) · ${comPendencia} com pendência(s) · ${vencidas} vencida(s) · ${nuncaAuditados} nunca auditado(s) — de ${totalSetores} setor(es).`,
      { x: marginX, y, size: 10, font: fontBold, color: textDark },
    );
    y -= 18;

    const setoresExibidos = setoresChecklist.slice(0, MAX_SETORES_LISTADOS);
    for (const s of setoresExibidos) {
      ensureSpace(13);
      const pendencias = s.ultimaAuditoria
        ? contarNaoConformidades(s.ultimaAuditoria.respostas)
        : 0;
      const situacao = calcularSituacaoAuditoriaSetor(s.ultimaAuditoria);
      const situacaoTexto =
        situacao === "nunca_auditado"
          ? "Nunca auditado"
          : situacao === "pendente"
            ? `${pendencias} pendência${pendencias === 1 ? "" : "s"}`
            : situacao === "vencida"
              ? "Auditoria vencida"
              : "Conforme";
      const detalheData = s.ultimaAuditoria
        ? ` · última auditoria: ${formatDate(s.ultimaAuditoria.data)} (${s.ultimaAuditoria.responsavel})`
        : "";
      const linha = fitSingleLine(
        `•  ${s.nome} — ${situacaoTexto}${detalheData}`,
        fontRegular,
        9,
        pageWidth - marginX * 2 - 8,
      );
      page.drawText(linha, {
        x: marginX + 8,
        y,
        size: 9,
        font: fontRegular,
        color: textDark,
      });
      y -= 12;
    }
    if (totalSetores > MAX_SETORES_LISTADOS) {
      ensureSpace(13);
      page.drawText(
        `+ ${totalSetores - MAX_SETORES_LISTADOS} outro(s) — ver aba Checklist de campo no sistema.`,
        { x: marginX + 8, y, size: 8.5, font: fontOblique, color: textMuted },
      );
      y -= 12;
    }
  }
  y -= 8;

  // ---- Nota de abrangência (mesmo texto/espírito da aba Visão geral) ----
  ensureSpace(60);
  page.drawLine({
    start: { x: marginX, y },
    end: { x: pageWidth - marginX, y },
    thickness: 0.5,
    color: lineColor,
  });
  y -= 14;
  drawWrappedText(
    "Este relatório reflete o que está registrado no sistema MorSafe na data de geração — não substitui a observação em campo nem representa, por si só, uma declaração de conformidade com a NR-06 (Portaria MTb nº 3.214, de 8 de junho de 1978). As pendências identificadas devem ser avaliadas e tratadas pela organização responsável.",
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
      "Content-Disposition": `${forcarDownload ? "attachment" : "inline"}; filename="relatorio-auditoria-nr06-${sanitizeFileName(
        empresa?.nome ?? user.empresaNome ?? "empresa",
      )}-${hojeArquivo}.pdf"`,
    },
  });
}
