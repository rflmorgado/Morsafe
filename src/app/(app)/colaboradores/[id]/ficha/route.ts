import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getColaboradorDetalhe } from "@/lib/data/colaboradores";
import { getCurrentUser } from "@/lib/data/current-user";
import { getEmpresaAtual } from "@/lib/data/empresa";
import { createClient } from "@/lib/supabase/server";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";
import { criarVerificacaoDocumento } from "@/lib/data/verificacao-documento";

const TIPO_LABEL: Record<string, string> = {
  entrega: "Entrega",
  devolucao: "Devolução",
  recusa: "Recusa",
};

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

// Usado só na linha "Registrado por" de cada evento (ver mais abaixo) —
// diferente de formatDate, mostra também a hora, porque vem de criado_em
// (timestamp do servidor), não do "data"/"hora" digitado no formulário.
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Por padrão o PDF abre direto no navegador ("Visualizar ficha", na
  // listagem de colaboradores) — mais rápido pra uma conferência pontual e
  // não obriga a pessoa a ir até a pasta de downloads. O fluxo de
  // desligamento (ver desligar-colaborador-button.tsx) é a exceção: ali o
  // download é uma etapa formal de conformidade NR-06 antes de desligar
  // alguém, então força o download de verdade via ?download=1.
  const forcarDownload = new URL(request.url).searchParams.has("download");

  const [colaborador, user] = await Promise.all([
    getColaboradorDetalhe(id),
    getCurrentUser(),
  ]);

  // O proxy (middleware) já bloqueia quem não está logado antes de chegar
  // aqui, mas confirmamos de novo — abrir/baixar a ficha é permitido pra
  // qualquer papel autenticado (inclusive "leitura"), então não há checagem
  // de papel, só de sessão. O isolamento entre empresas fica por conta do
  // RLS em getColaboradorDetalhe.
  if (!user) {
    return NextResponse.json(
      { error: "Sessão expirada. Faça login novamente." },
      { status: 401 },
    );
  }

  if (!colaborador) {
    return NextResponse.json(
      { error: "Colaborador não encontrado." },
      { status: 404 },
    );
  }

  // Baixar a ficha dá acesso ao histórico de EPI do colaborador (dado
  // sensível), então entra no histórico de ações igual às demais mutações —
  // registra quem baixou a ficha de quem, e quando. Aproveita a mesma volta
  // pro banco pra já trazer o logo da empresa (cadastrado em /empresa),
  // exibido no topo do documento — ver getEmpresaAtual.
  const [, empresa] = await Promise.all([
    user.empresaId
      ? registrarLogAuditoria({
          supabase: await createClient(),
          empresaId: user.empresaId,
          tabela: "colaboradores",
          registroId: id,
          acao: "baixou_ficha",
          usuarioId: user.id,
          detalhes: { nome: colaborador.nome },
        })
      : Promise.resolve(),
    user.empresaId ? getEmpresaAtual(user.empresaId) : Promise.resolve(null),
  ]);

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Selo MorSafe (letreiro no canto superior) — o PNG é um escudo branco,
  // por isso precisa de um fundo colorido atrás para aparecer na página.
  const shieldBytes = await fs.readFile(
    path.join(process.cwd(), "public/brand/shield.png"),
  );
  const shieldImage = await pdfDoc.embedPng(shieldBytes);

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

  // Usada nas linhas do histórico (uma linha por registro, ver abaixo): em
  // vez de quebrar em várias linhas, corta com "…" quando não cabe — mantém
  // cada registro numa única linha compacta, o que é o que permite caber
  // muito mais entregas/devoluções/recusas por página.
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

  // Selo MorSafe no canto superior direito — badge redondo na cor da marca
  // com o escudo branco por cima, marca "MorSafe" e uma frase de assinatura.
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

  const shieldSize = badgeR * 1.15;
  page.drawImage(shieldImage, {
    x: badgeCenterX - shieldSize / 2,
    y: badgeCenterY - shieldSize / 2,
    width: shieldSize,
    height: shieldSize,
  });

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

  // Logo da empresa cliente (opcional, cadastrado em /empresa) — desenhado
  // acima do título, no canto superior esquerdo, simetricamente oposto ao
  // selo do MorSafe à direita. Empresas que ainda não cadastraram um logo
  // (a maioria, até passarem por /empresa) simplesmente não reservam esse
  // espaço — o título começa direto no topo, como sempre foi.
  //
  // O espaço reservado abaixo do logo é SEMPRE o mesmo (LOGO_MAX_ALTURA +
  // LOGO_GAP_ABAIXO), não a altura real do logo depois de redimensionado —
  // isso importa porque cada empresa cliente sobe um logo com proporção
  // diferente (quadrado, horizontal tipo letreiro, vertical...), e sem
  // isso o título ficaria mais perto ou mais longe do logo dependendo do
  // formato de cada uma. Com o espaço fixo, o título sempre começa na
  // mesma altura, não importa o logo.
  const LOGO_MAX_LARGURA = 160;
  const LOGO_MAX_ALTURA = 40;
  // pdf-lib posiciona texto pela linha de base (baseline), não pelo topo da
  // letra — boa parte deste valor é "consumida" pela própria altura da
  // fonte do título (18pt bold) acima da linha de base, não é espaço em
  // branco puro. Ajustado visualmente (ver scratchpad de testes) até sobrar
  // uns 16-18pt de vão de fato entre o logo e o título.
  const LOGO_GAP_ABAIXO = 30;

  const topoHeaderY = y;
  if (empresa?.logoUrl) {
    try {
      const base64 = empresa.logoUrl.split(",")[1] ?? "";
      const logoImagem = await pdfDoc.embedPng(Buffer.from(base64, "base64"));
      const escala = Math.min(
        LOGO_MAX_LARGURA / logoImagem.width,
        LOGO_MAX_ALTURA / logoImagem.height,
        1, // nunca amplia um logo pequeno, só reduz um grande
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
      console.error("ficha: falha ao incorporar logo da empresa:", e);
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
  // Reforça, no próprio documento, que a orientação sobre uso de EPI não
  // ficou só na entrega — importante para a defesa da empresa numa eventual
  // ação trabalhista (a NR-06 exige orientação sobre uso, guarda e
  // conservação, não só a entrega em si).
  page.drawText(
    colaborador.dataIntegracaoSeguranca
      ? `Integração de Segurança / Treinamento NR-06: ${formatDate(colaborador.dataIntegracaoSeguranca)}`
      : "Integração de Segurança / Treinamento NR-06: não registrada",
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
    // Layout compacto — uma linha de título + uma linha de detalhe por
    // registro (sem quebra, ver fitSingleLine), com a assinatura ao lado
    // direito, na frente do item, em vez de abaixo do texto. Isso reduz a
    // altura de cada linha de ~95pt (layout anterior, com assinatura
    // embaixo) para ~36pt, essencial pra colaboradores antigos com dezenas
    // de registros não gerarem fichas de centenas de páginas.
    const ASSINATURA_LARGURA = 58;
    const GAP_ASSINATURA = 10;
    const TITULO_SIZE = 9.5;
    const DETALHE_SIZE = 8;
    const RESPONSAVEL_SIZE = 7;
    const ALTURA_TEXTO = 28; // título + detalhe + "registrado por", já com o espaçamento entre eles

    // Rótulo da coluna de assinatura — sem isso, a miniatura ao lado de cada
    // entrega aparece "solta", sem indicar que aquele espaço é reservado
    // pra assinatura do colaborador. Alinhado à mesma borda direita onde as
    // imagens de assinatura são desenhadas (ver imgX abaixo).
    const rotuloAssinatura = "Assinatura do colaborador";
    const rotuloAssinaturaSize = 7.5;
    const rotuloAssinaturaLargura = fontBold.widthOfTextAtSize(
      rotuloAssinatura,
      rotuloAssinaturaSize,
    );
    ensureSpace(ALTURA_TEXTO);
    page.drawText(rotuloAssinatura, {
      x: pageWidth - marginX - rotuloAssinaturaLargura,
      y,
      size: rotuloAssinaturaSize,
      font: fontBold,
      color: textMuted,
    });
    y -= 14;

    for (const evento of colaborador.eventos) {
      let assinaturaImagem: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null =
        null;
      let assinaturaAltura = 0;

      if (evento.tipo === "entrega" && evento.assinaturaUrl) {
        try {
          const base64 = evento.assinaturaUrl.split(",")[1] ?? "";
          assinaturaImagem = await pdfDoc.embedPng(
            Buffer.from(base64, "base64"),
          );
          assinaturaAltura =
            ASSINATURA_LARGURA *
            (assinaturaImagem.height / assinaturaImagem.width);
        } catch (e) {
          console.error("ficha: falha ao incorporar assinatura:", e);
          assinaturaImagem = null;
        }
      }

      const alturaLinha = Math.max(ALTURA_TEXTO, assinaturaAltura);
      ensureSpace(alturaLinha + 14);

      const topoLinhaY = y;
      const larguraMaximaTexto = assinaturaImagem
        ? pageWidth - marginX * 2 - ASSINATURA_LARGURA - GAP_ASSINATURA
        : pageWidth - marginX * 2;

      const caLabel = evento.ca ? ` (CA ${evento.ca})` : "";
      // Sempre exibe a quantidade, mesmo quando é 1 — melhor deixar
      // explícito no documento do que dar margem a dúvida sobre quantas
      // unidades foram entregues numa eventual contestação.
      const qtdLabel =
        typeof evento.quantidade === "number" ? ` · Qtd: ${evento.quantidade}` : "";
      const tituloTexto = fitSingleLine(
        `${TIPO_LABEL[evento.tipo]} — ${evento.epi}${caLabel}${qtdLabel}`,
        fontBold,
        TITULO_SIZE,
        larguraMaximaTexto,
      );
      page.drawText(tituloTexto, {
        x: marginX,
        y: topoLinhaY,
        size: TITULO_SIZE,
        font: fontBold,
        color: textDark,
      });

      const detalheTexto = fitSingleLine(
        `${formatDate(evento.data)} · ${evento.detalhe}`,
        fontRegular,
        DETALHE_SIZE,
        larguraMaximaTexto,
      );
      page.drawText(detalheTexto, {
        x: marginX,
        y: topoLinhaY - 11,
        size: DETALHE_SIZE,
        font: fontRegular,
        color: textMuted,
      });

      // "Registrado por" — quem lançou o registro no sistema e quando, pelo
      // timestamp do próprio servidor (criado_em), não pela data/hora
      // digitada no formulário. Isso é o que permite, numa eventual ação
      // trabalhista, identificar e (se preciso) chamar como testemunha quem
      // de fato fez aquele registro — sem isso, só se sabia quem assinou
      // como tendo recebido, nunca quem tinha lançado a entrega.
      const responsavelTexto = evento.criadoEm
        ? fitSingleLine(
            evento.responsavelNome
              ? `Registrado por ${evento.responsavelNome} em ${formatDateTime(evento.criadoEm)}`
              : `Registrado em ${formatDateTime(evento.criadoEm)}`,
            fontRegular,
            RESPONSAVEL_SIZE,
            larguraMaximaTexto,
          )
        : "Registro sem responsável/data de lançamento identificados";
      page.drawText(responsavelTexto, {
        x: marginX,
        y: topoLinhaY - 20,
        size: RESPONSAVEL_SIZE,
        font: fontRegular,
        color: textMuted,
      });

      if (assinaturaImagem) {
        const imgX = pageWidth - marginX - ASSINATURA_LARGURA;
        const imgY = topoLinhaY - (alturaLinha + assinaturaAltura) / 2 + 4;
        page.drawImage(assinaturaImagem, {
          x: imgX,
          y: imgY,
          width: ASSINATURA_LARGURA,
          height: assinaturaAltura,
        });
      }

      y = topoLinhaY - alturaLinha - 6;
      page.drawLine({
        start: { x: marginX, y },
        end: { x: pageWidth - marginX, y },
        thickness: 0.5,
        color: lineColor,
      });
      y -= 10;
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

  // Código de verificação pública — permite que um terceiro (juiz, auditor,
  // perito), sem login nenhum no MorSafe, confirme em /verificar/<código>
  // que este documento foi realmente emitido pelo sistema, pra quem, quando
  // e com qual conteúdo (hash). Ver lib/data/verificacao-documento.ts. Se a
  // geração falhar por qualquer motivo (ex: migração do banco ainda não
  // aplicada), a ficha continua sendo emitida normalmente, só sem esse
  // rodapé — nunca trava a emissão do documento por causa disso.
  if (user.empresaId) {
    try {
      const verificacao = await criarVerificacaoDocumento({
        empresaId: user.empresaId,
        empresaNome: user.empresaNome ?? empresaNomeDoc,
        colaboradorId: id,
        colaboradorNome: colaborador.nome,
        tipoDocumento: "ficha_epi",
        geradoPor: user.id,
        eventos: colaborador.eventos.map((evento) => ({
          id: evento.id,
          tipo: evento.tipo,
          data: evento.data,
          criadoEm: evento.criadoEm,
          epi: evento.epi,
          quantidade: evento.quantidade,
        })),
      });

      if (verificacao) {
        const origin = new URL(request.url).origin;
        const linkVerificacao = `${origin}/verificar/${verificacao.codigo}`;
        y -= 12;
        ensureSpace(22);
        drawWrappedText(
          `Verifique a autenticidade deste documento em ${linkVerificacao} (código ${verificacao.codigo}).`,
          {
            size: 8,
            font: fontBold,
            color: brand,
            lineHeight: 11,
            maxWidth: pageWidth - marginX * 2,
          },
        );
      }
    } catch (e) {
      console.error("ficha: falha ao gerar código de verificação:", e);
    }
  }

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${forcarDownload ? "attachment" : "inline"}; filename="ficha-epi-${sanitizeFileName(
        colaborador.nome,
      )}.pdf"`,
    },
  });
}
