"use client";

/**
 * Menu mobile do header da landing page. Antes, o <nav> com os links
 * (Início, Funcionalidades, Planos, Sobre, Contato) ficava "hidden ...
 * md:flex" — ou seja, sumia completamente abaixo do breakpoint md, sem
 * nenhuma alternativa pra quem acessa pelo celular. Adicionado em
 * 20/10/2026 depois que o Rafael testou o site no mobile e notou que não
 * dava pra pular direto pra uma seção sem rolar a página inteira.
 *
 * Client component separado (em vez de colocar o useState direto em
 * page.tsx) porque page.tsx é Server Component — extrair só o pedacinho
 * interativo evita converter a página inteira.
 */

import Link from "next/link";
import { useState } from "react";

const LINKS = [
  { href: "#inicio", label: "Início" },
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#planos", label: "Planos" },
  { href: "#sobre", label: "Sobre" },
  { href: "#contato", label: "Contato" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-surface-muted"
      >
        {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
      </button>

      {/* position: sticky no <header> (page.tsx) já cria um containing
          block pra esse absolute — não precisa de "relative" extra lá. */}
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-border-subtle bg-surface shadow-card">
          <nav className="mx-auto flex max-w-6xl flex-col px-5 py-2">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-[14.5px] font-medium text-foreground hover:bg-surface-muted"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/entrar"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-3 text-[14.5px] font-medium text-text-secondary hover:bg-surface-muted"
            >
              Entrar
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}
