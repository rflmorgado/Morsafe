"use client";

/**
 * Link "Ver fatura" (abre a fatura do Asaas em nova aba). Precisa ser um
 * Client Component à parte porque tem onClick (stopPropagation) — um <a>
 * com handler de evento criado direto num Server Component (pagamentos/
 * page.tsx) quebra com "Event handlers cannot be passed to Client
 * Component props" ao servir a página (mesmo padrão de botão isolado que
 * marcar-pago-button.tsx já usa, só que pra link em vez de botão).
 */
export function VerFaturaLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      // stopPropagation: mesmo motivo de marcar-pago-button.tsx — a linha
      // inteira leva ao detalhe da empresa.
      onClick={(e) => e.stopPropagation()}
      className="text-[12px] font-semibold text-brand-700 underline-offset-2 hover:underline"
    >
      Ver fatura
    </a>
  );
}
