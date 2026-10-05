"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";

/**
 * Mesmo comportamento do ClickableRow (clicável, navegável por teclado,
 * ignora Enter/Espaço quando o foco está num botão filho — ex.: Editar,
 * Desligar), só que para um <div> em vez de um <tr>. Existe porque listas
 * em telas estreitas (abaixo do breakpoint `lg`, onde a tabela precisaria
 * rolar de lado pra mostrar as 6+ colunas) viram uma lista de "cartões"
 * em vez de tabela — ver colaboradores/page.tsx, pedido do Rafael
 * (05/10/2026: "compactar melhor... sem precisar dessa seta lateral").
 */
export function ClickableCard({
  href,
  children,
  className = "",
  label,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const router = useRouter();

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(href);
    }
  }

  return (
    <div
      onClick={() => router.push(href)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={label}
      className={`cursor-pointer transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${className}`}
    >
      {children}
    </div>
  );
}
