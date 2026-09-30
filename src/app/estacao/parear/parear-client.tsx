"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldIcon } from "@/components/brand/shield-icon";
import { exchangeCodigoPareamento } from "../actions";
import { salvarCredencialEstacao } from "@/lib/estacao-assinatura/device-storage";

type Estado =
  | { fase: "pareando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "sucesso"; nome: string };

const SEM_CODIGO_ESTADO: Estado = {
  fase: "erro",
  mensagem:
    "Nenhum código encontrado no link. Escaneie o QR de novo a partir da tela de administração.",
};

type SistemaOperacional = "ios" | "android" | "outro";

// Sem isso, "sucesso" redirecionava sozinho pra /estacao em 1.2s — tempo
// nenhum pra quem está configurando o aparelho ler qualquer instrução. A
// detecção de SO só decide QUAL passo a passo mostrar (iOS e Android
// instalam "à tela de início" de um jeito bem diferente) — um engano aqui
// não trava ninguém, só mostra o passo a passo errado, e "outro" cobre
// esse caso com os dois conjuntos de instrução.
function detectarSistemaOperacional(): SistemaOperacional {
  if (typeof navigator === "undefined") return "outro";
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "outro";
}

export function ParearClient({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [so] = useState<SistemaOperacional>(detectarSistemaOperacional);
  // `codigo` vem do searchParams e não muda depois do primeiro render desta
  // tela, então dá pra decidir o estado inicial direto (sem precisar de um
  // efeito só pra isso).
  const [estado, setEstado] = useState<Estado>(() =>
    codigo ? { fase: "pareando" } : SEM_CODIGO_ESTADO,
  );

  useEffect(() => {
    if (!codigo) return;

    let cancelado = false;

    exchangeCodigoPareamento(codigo).then((result) => {
      if (cancelado) return;
      if (result.error || !result.token) {
        setEstado({
          fase: "erro",
          mensagem: result.error ?? "Não foi possível parear este aparelho.",
        });
        return;
      }
      salvarCredencialEstacao(result.token, result.estacaoNome);
      setEstado({ fase: "sucesso", nome: result.estacaoNome });
    });

    return () => {
      cancelado = true;
    };
  }, [codigo]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "var(--brand-950)" }}
    >
      <div className="flex items-center gap-2.5">
        <ShieldIcon className="h-8 w-8" />
        <span className="text-xl font-bold tracking-tight text-brand-300">
          Mor<span className="font-extrabold text-brand-500">Safe</span>
        </span>
      </div>

      {estado.fase === "pareando" && (
        <p className="text-[14px] text-white/70">Pareando aparelho…</p>
      )}

      {estado.fase === "sucesso" && (
        <div className="w-full max-w-sm space-y-4 text-left">
          <div className="text-center">
            <p className="text-[15px] font-semibold text-white">
              Aparelho pareado com sucesso!
            </p>
            <p className="text-[13px] text-white/60">{estado.nome}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-brand-300">
              Último passo — adicione à tela de início
            </p>
            <p className="mt-1 text-[12.5px] text-white/60">
              Sem isso, o aparelho pode voltar a pedir o QR code toda vez que
              a tela apagar ou o app sair da memória.
            </p>

            {so === "android" && (
              <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-[13px] text-white/80">
                <li>
                  Toque no menu (⋮) no canto superior direito do Chrome.
                </li>
                <li>
                  Toque em &ldquo;Adicionar à tela inicial&rdquo; ou
                  &ldquo;Instalar app&rdquo;.
                </li>
                <li>Confirme tocando em &ldquo;Adicionar&rdquo;/&ldquo;Instalar&rdquo;.</li>
              </ol>
            )}

            {so === "ios" && (
              <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-[13px] text-white/80">
                <li>
                  Toque no ícone de compartilhar (o quadrado com a seta pra
                  cima) na barra do Safari.
                </li>
                <li>Role e toque em &ldquo;Adicionar à Tela de Início&rdquo;.</li>
                <li>Toque em &ldquo;Adicionar&rdquo; no canto superior direito.</li>
              </ol>
            )}

            {so === "outro" && (
              <p className="mt-3 text-[13px] text-white/80">
                No Android: menu (⋮) do Chrome → &ldquo;Adicionar à tela
                inicial&rdquo;. No iPhone: ícone de compartilhar do Safari →
                &ldquo;Adicionar à Tela de Início&rdquo;.
              </p>
            )}

            <p className="mt-3 text-[12px] text-white/50">
              Depois de adicionado, use sempre esse ícone (não o navegador)
              pra abrir a estação.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.replace("/estacao")}
            className="w-full rounded-lg bg-brand-700 px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-brand-800"
          >
            Já adicionei — ir para a tela de espera
          </button>
        </div>
      )}

      {estado.fase === "erro" && (
        <div className="max-w-sm space-y-3">
          <p className="text-[14px] font-semibold text-danger-text">
            Não foi possível parear
          </p>
          <p className="text-[13px] text-white/70">{estado.mensagem}</p>
        </div>
      )}
    </div>
  );
}
