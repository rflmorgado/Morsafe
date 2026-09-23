"use client";

import { useEffect, useRef, useState } from "react";

const LARGURA = 400;
const ALTURA = 140;

/**
 * Campo de assinatura por toque/mouse — usado no formulário de entrega de
 * EPI pra coletar a confirmação de recebimento do colaborador
 * (assinatura_url em `entregas`, NOT NULL no banco). Não existe upload pra
 * Supabase Storage no app ainda (nenhuma tela usa isso hoje, nem
 * epis.arquivo_ca_url), então em vez de criar essa infraestrutura nova só
 * pra este campo, a assinatura é exportada como PNG em data URL e guardada
 * direto na coluna de texto — leve o bastante (um traço simples) pra não
 * pesar no banco, e sem depender de nenhum bucket configurado à parte.
 *
 * O input escondido (name="assinatura_url") é o que de fato viaja com o
 * FormData do form ao redor — mesmo padrão dos outros campos desta tela,
 * sem precisar de estado controlado no componente pai.
 */
export function SignaturePad({ name = "assinatura_url" }: { name?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const desenhandoRef = useRef(false);
  const [temAssinatura, setTemAssinatura] = useState(false);
  const [dataUrl, setDataUrl] = useState("");

  function preencherFundoBranco() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  useEffect(() => {
    preencherFundoBranco();
  }, []);

  function posicao(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Coordenadas do evento vêm em pixels de CSS; a resolução interna do
    // canvas é fixa (LARGURA x ALTURA) e pode ser exibida em outro
    // tamanho (ex.: modal mais estreito no celular) — sem essa escala o
    // traço sai deslocado/distorcido.
    const escalaX = canvas.width / rect.width;
    const escalaY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * escalaX,
      y: (e.clientY - rect.top) * escalaY,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    desenhandoRef.current = true;
    const { x, y } = posicao(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhandoRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicao(e);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#16321f";
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!temAssinatura) setTemAssinatura(true);
  }

  function handlePointerUp() {
    if (!desenhandoRef.current) return;
    desenhandoRef.current = false;
    setDataUrl(canvasRef.current?.toDataURL("image/png") ?? "");
  }

  function limpar() {
    preencherFundoBranco();
    setTemAssinatura(false);
    setDataUrl("");
  }

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-border-strong bg-white">
        <canvas
          ref={canvasRef}
          width={LARGURA}
          height={ALTURA}
          className="block w-full touch-none"
          style={{ height: ALTURA }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] text-text-muted">
          {temAssinatura
            ? "Assinatura coletada"
            : "Peça pro colaborador assinar aqui (dedo ou mouse)"}
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
