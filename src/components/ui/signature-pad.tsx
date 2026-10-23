"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ALTURA_MIN = 120;
const ALTURA_MAX = 240;
const ALTURA_PROPORCAO = 0.3; // altura do canvas ~= 30% da largura, dentro dos limites acima
const LARGURA_INICIAL = 400;
const ALTURA_INICIAL = 140;
const DPR_MAXIMO = 2; // acima disso o ganho de nitidez não compensa o tamanho do PNG salvo no banco

type Ponto = { x: number; y: number }; // normalizado 0–1 relativo ao tamanho do canvas
type Traco = Ponto[];

/**
 * Campo de assinatura por toque/caneta/mouse — usado no formulário de entrega
 * e de devolução de EPI pra coletar a confirmação do colaborador
 * (assinatura_url em `entregas` e `devolucoes`, NOT NULL no banco). Não
 * existe upload pra Supabase Storage no app ainda (nenhuma tela usa isso
 * hoje, nem epis.arquivo_ca_url), então em vez de criar essa infraestrutura
 * nova só pra este campo, a assinatura é exportada como PNG em data URL e
 * guardada direto na coluna de texto — leve o bastante (um traço simples
 * sobre fundo branco) pra não pesar no banco, e sem depender de nenhum
 * bucket configurado à parte.
 *
 * O input escondido (name="assinatura_url") é o que de fato viaja com o
 * FormData do form ao redor — mesmo padrão dos outros campos desta tela,
 * sem precisar de estado controlado no componente pai.
 *
 * Traços são guardados como pontos normalizados (0–1), não em pixels do
 * canvas: isso permite redesenhar tudo sem distorcer quando o canvas muda
 * de tamanho — essencial pra estação de assinatura acompanhar a rotação do
 * aparelho (retrato/paisagem) no meio de uma assinatura, sem perder o que
 * já foi desenhado. A resolução interna do canvas segue o
 * devicePixelRatio do aparelho (até DPR_MAXIMO), porque antes o canvas
 * tinha resolução fixa de 400×140 independente da tela — numa tela de alta
 * densidade isso borra qualquer traço fino, o que é exatamente o problema
 * de "a caneta de ponta fina não respondeu bem" relatado em uso real.
 */
export function SignaturePad({
  name = "assinatura_url",
  onAssinaturaChange,
}: {
  name?: string;
  // Avisa o formulário ao redor se o campo está vazio ou não — usado em
  // registrar-entrega-button.tsx e registrar-devolucao-button.tsx pra
  // desabilitar o botão de enviar enquanto não houver assinatura (sem isso,
  // dava pra tentar enviar em branco e só descobrir que faltava assinar
  // depois da viagem ao servidor, ver actions.ts).
  onAssinaturaChange?: (temAssinatura: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tracosRef = useRef<Traco[]>([]);
  const tracoAtualRef = useRef<Traco | null>(null);
  const desenhandoRef = useRef(false);
  // Dimensões do "backing store" do canvas (já multiplicadas pelo
  // devicePixelRatio) e o fator de escala usado pra espessura do traço.
  const tamanhoRef = useRef({
    largura: LARGURA_INICIAL,
    altura: ALTURA_INICIAL,
    escala: 1,
  });
  const [temAssinatura, setTemAssinatura] = useState(false);
  const [dataUrl, setDataUrl] = useState("");

  // Dispara sempre que temAssinatura muda (inclusive na primeira renderização,
  // com false — inofensivo, já que o pai começa assumindo vazio) em vez de
  // chamar onAssinaturaChange em cada handler separado, pra não esquecer
  // nenhum ponto de entrada (desenhar, limpar) de avisar o pai.
  useEffect(() => {
    onAssinaturaChange?.(temAssinatura);
  }, [temAssinatura, onAssinaturaChange]);

  const redesenhar = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { largura, altura, escala } = tamanhoRef.current;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2.4 * escala;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#16321f";
    ctx.fillStyle = ctx.strokeStyle;

    for (const traco of tracosRef.current) {
      if (traco.length === 0) continue;
      if (traco.length === 1) {
        // Toque rápido sem arrastar — desenha um pingo, senão o traço some.
        const p = traco[0];
        ctx.beginPath();
        ctx.arc(p.x * largura, p.y * altura, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(traco[0].x * largura, traco[0].y * altura);
      // Curva quadrática passando pelo ponto médio entre cada par de
      // pontos: amacia o traço de canetas de ponta fina, que reportam
      // segmentos curtos e angulosos a cada amostragem.
      for (let i = 1; i < traco.length - 1; i++) {
        const atual = traco[i];
        const proximo = traco[i + 1];
        const mx = (atual.x + proximo.x) / 2;
        const my = (atual.y + proximo.y) / 2;
        ctx.quadraticCurveTo(
          atual.x * largura,
          atual.y * altura,
          mx * largura,
          my * altura,
        );
      }
      const ultimo = traco[traco.length - 1];
      ctx.lineTo(ultimo.x * largura, ultimo.y * altura);
      ctx.stroke();
    }
  }, []);

  const redimensionar = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const larguraCss = container.clientWidth || LARGURA_INICIAL;
    const alturaCss = Math.min(
      ALTURA_MAX,
      Math.max(ALTURA_MIN, larguraCss * ALTURA_PROPORCAO),
    );
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAXIMO);

    canvas.style.width = `${larguraCss}px`;
    canvas.style.height = `${alturaCss}px`;
    canvas.width = Math.round(larguraCss * dpr);
    canvas.height = Math.round(alturaCss * dpr);
    tamanhoRef.current = {
      largura: canvas.width,
      altura: canvas.height,
      escala: dpr,
    };
    redesenhar();
  }, [redesenhar]);

  useEffect(() => {
    redimensionar();
    // ResizeObserver cobre a maioria dos casos (inclusive rotação, já que
    // o contêiner muda de largura); orientationchange é reforço pra
    // aparelhos onde o observer demora a disparar durante a rotação.
    const observer = new ResizeObserver(() => redimensionar());
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("orientationchange", redimensionar);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", redimensionar);
    };
  }, [redimensionar]);

  function posicaoNormalizada(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function registrarMovimento(e: React.PointerEvent<HTMLCanvasElement>) {
    const traco = tracoAtualRef.current;
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!traco || !rect || rect.width === 0 || rect.height === 0) return;
    const nativo = e.nativeEvent as PointerEvent;
    // getCoalescedEvents() recupera os pontos que o navegador amostrou
    // entre um pointermove e outro — sem isso, um traço rápido de caneta
    // de ponta fina sai picotado/com cantos retos, porque cada evento só
    // carrega a posição mais recente e perde as intermediárias.
    const eventos =
      typeof nativo.getCoalescedEvents === "function"
        ? nativo.getCoalescedEvents()
        : [];
    const amostras = eventos.length > 0 ? eventos : [nativo];
    for (const amostra of amostras) {
      traco.push({
        x: Math.min(1, Math.max(0, (amostra.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (amostra.clientY - rect.top) / rect.height)),
      });
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    desenhandoRef.current = true;
    const traco: Traco = [posicaoNormalizada(e)];
    tracoAtualRef.current = traco;
    tracosRef.current.push(traco);
    e.currentTarget.setPointerCapture(e.pointerId);
    redesenhar();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhandoRef.current) return;
    registrarMovimento(e);
    redesenhar();
    if (!temAssinatura) setTemAssinatura(true);
  }

  function handlePointerUp() {
    if (!desenhandoRef.current) return;
    desenhandoRef.current = false;
    tracoAtualRef.current = null;
    setDataUrl(canvasRef.current?.toDataURL("image/png") ?? "");
  }

  function limpar() {
    tracosRef.current = [];
    tracoAtualRef.current = null;
    desenhandoRef.current = false;
    setTemAssinatura(false);
    setDataUrl("");
    redesenhar();
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-border-strong bg-white"
      >
        <canvas
          ref={canvasRef}
          width={LARGURA_INICIAL}
          height={ALTURA_INICIAL}
          className="block w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] text-text-muted">
          {temAssinatura
            ? "Assinatura coletada"
            : "Peça pro colaborador assinar aqui (dedo ou caneta)"}
        </span>
        <button
          type="button"
          onClick={limpar}
          className="text-[11.5px] font-semibold text-text-secondary transition hover:text-brand-700"
        >
          Limpar
        </button>
      </div>
      <input type="hidden" name={name} value={dataUrl} />
    </div>
  );
}
