"use client";

import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      {/* flex-col + max-h aqui é o que faz o formulário caber na tela do
          celular: sem isso, um formulário com vários campos (ex.: Novo
          colaborador) ficava mais alto que a tela e o botão "Salvar" saía
          fora da área visível, sem nenhuma barra de rolagem pra alcançá-lo —
          o formulário ficava impossível de enviar no celular. Agora só o
          corpo rola (overflow-y-auto), o cabeçalho com o título/fechar fica
          sempre fixo no topo. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col rounded-[14px] border border-border-subtle bg-surface shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-5 py-4">
          <h3 className="text-[15px] font-bold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
