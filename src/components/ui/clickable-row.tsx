"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";

export function ClickableRow({
  href,
  children,
  className = "",
  label,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  // Lido por leitor de tela ao focar a linha (ex: "Ver detalhes de Fulano")
  // — sem isso a linha ficava sem nenhum jeito de chegar até ela nem de
  // ativá-la por teclado, só reagindo a clique de mouse (Item 7 da revisão).
  label?: string;
}) {
  const router = useRouter();

  function handleKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    // Só reage a Enter/Espaço disparado na própria linha — os botões de
    // ação dentro dela (Editar, Desligar, etc.) já têm foco e handlers
    // próprios, então ignorar aqui evita navegar pra ficha por cima do que
    // o botão focado estava fazendo.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(href);
    }
  }

  return (
    <tr
      onClick={() => router.push(href)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={label}
      className={`cursor-pointer border-b border-border-subtle transition last:border-b-0 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${className}`}
    >
      {children}
    </tr>
  );
}
