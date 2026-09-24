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

export function ParearClient({ codigo }: { codigo: string }) {
  const router = useRouter();
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
      setTimeout(() => router.replace("/estacao"), 1200);
    });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="space-y-1">
          <p className="text-[15px] font-semibold text-white">
            Aparelho pareado com sucesso!
          </p>
          <p className="text-[13px] text-white/60">
            {estado.nome} — abrindo o modo estação…
          </p>
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
