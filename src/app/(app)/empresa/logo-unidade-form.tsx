"use client";

import { useRef, useState, useTransition } from "react";
import { atualizarLogoUnidade } from "./actions";

// Mesmos limites do logo da empresa (ver logo-empresa-form.tsx).
const LOGO_MAX_LADO = 320;
const TAMANHO_MAX_ARQUIVO = 5 * 1024 * 1024;

/**
 * Upload de logo de uma unidade/filial do grupo (ex: Vinitrade) — mesma
 * mecânica de LogoEmpresaForm (redimensiona no navegador, guarda como PNG
 * em data URL, sem Supabase Storage configurado), só que salva em
 * unidades.logo_url em vez de empresas.logo_url. Renderizado uma vez por
 * unidade na seção "Unidades do grupo" de /empresa, só quando a empresa tem
 * mais de uma unidade cadastrada (ver page.tsx) — a maioria dos clientes do
 * MorSafe tem uma só, e não precisa ver essa seção.
 */
export function LogoUnidadeForm({
  unidadeId,
  nome,
  logoAtual,
}: {
  unidadeId: string;
  nome: string;
  logoAtual: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(logoAtual);
  const [salvo, setSalvo] = useState<string | null>(logoAtual);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function processarArquivo(file: File) {
    setError(null);
    setSucesso(false);

    if (!file.type.startsWith("image/")) {
      setError("Escolha um arquivo de imagem (PNG, JPG ou WebP).");
      return;
    }
    if (file.size > TAMANHO_MAX_ARQUIVO) {
      setError("Escolha uma imagem de até 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(
          LOGO_MAX_LADO / img.width,
          LOGO_MAX_LADO / img.height,
          1,
        );
        const largura = Math.round(img.width * escala);
        const altura = Math.round(img.height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setError("Não foi possível processar essa imagem.");
          return;
        }
        ctx.drawImage(img, 0, 0, largura, altura);
        setPreview(canvas.toDataURL("image/png"));
      };
      img.onerror = () => setError("Não foi possível ler essa imagem.");
      img.src = reader.result as string;
    };
    reader.onerror = () => setError("Não foi possível ler esse arquivo.");
    reader.readAsDataURL(file);
  }

  function handleSalvar() {
    setError(null);
    setSucesso(false);
    startTransition(async () => {
      const result = await atualizarLogoUnidade(unidadeId, preview);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSalvo(preview);
      setSucesso(true);
    });
  }

  const alterado = preview !== salvo;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[12.5px] font-semibold text-text-secondary">
          Logo — {nome}
        </p>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-muted">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview local (data URL), não vem de rede
              <img
                src={preview}
                alt={`Logo — ${nome}`}
                className="max-h-16 max-w-16 object-contain"
              />
            ) : (
              <span className="px-2 text-center text-[10.5px] text-text-muted">
                Sem logo
              </span>
            )}
          </div>
          <div className="flex flex-col items-start gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processarArquivo(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-foreground transition hover:bg-surface-muted"
            >
              {preview ? "Trocar imagem" : "Escolher imagem"}
            </button>
            {preview && (
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setError(null);
                  setSucesso(false);
                }}
                className="text-[12.5px] font-semibold text-danger-text transition hover:opacity-80"
              >
                Remover logo
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11.5px] text-text-muted">
          Aparece no topo da Ficha de EPI dos colaboradores desta unidade, no
          lugar do logo da empresa. Prefira uma imagem com fundo transparente
          (PNG).
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
          {error}
        </p>
      )}
      {sucesso && (
        <p className="rounded-lg bg-brand-100 px-3.5 py-2.5 text-sm text-brand-700">
          Logo salvo.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSalvar}
          disabled={pending || !alterado}
          className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
