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
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[14px] border border-border-subtle bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
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
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
