"use client";

import { useEffect, useId, useRef } from "react";

const FOCAVEIS_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

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
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Guarda quem estava focado antes do modal abrir (normalmente o botão que
  // o acionou) pra devolver o foco pra lá quando fechar — sem isso, quem
  // navega por teclado ou leitor de tela perdia a posição na página toda
  // vez que um modal fechava (Item 7 da revisão).
  const focoAnteriorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap: sem isso, Tab/Shift+Tab levava o foco pro conteúdo por
      // trás do overlay escurecido — que continua tecnicamente na página,
      // só visualmente escondido atrás dele — deixando alguém navegando só
      // por teclado clicar em algo que nem devia estar acessível enquanto
      // o modal está aberto.
      if (e.key === "Tab" && dialogRef.current) {
        const focaveis =
          dialogRef.current.querySelectorAll<HTMLElement>(FOCAVEIS_SELECTOR);
        if (focaveis.length === 0) return;
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    focoAnteriorRef.current = document.activeElement as HTMLElement | null;
    // Foca o card do modal (não o primeiro campo do formulário) — evita,
    // por exemplo, abrir o teclado virtual num celular só porque o modal
    // apareceu na tela.
    dialogRef.current?.focus();
    return () => {
      focoAnteriorRef.current?.focus();
    };
  }, [open]);

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col rounded-[14px] border border-border-subtle bg-surface shadow-xl outline-none"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-5 py-4">
          <h3 id={titleId} className="text-[15px] font-bold text-foreground">
            {title}
          </h3>
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
