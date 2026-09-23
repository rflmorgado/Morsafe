import Link from "next/link";
import { ShieldIcon } from "@/components/brand/shield-icon";

type MetaItem = { label: string; value: string };

/**
 * Casco compartilhado das páginas públicas de LGPD/Segurança (Política de
 * Privacidade, Segurança da Informação). Fora do grupo (app) — não passa
 * pelo layout autenticado, e /login, /politica-de-privacidade e
 * /seguranca-da-informacao ficam liberadas em PUBLIC_PATHS no middleware.
 */
export function LegalPageShell({
  kicker,
  title,
  meta,
  children,
}: {
  kicker: string;
  title: string;
  meta: MetaItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <ShieldIcon className="h-7 w-7" />
            <span className="text-[15px] font-bold tracking-tight text-brand-900">
              MorSafe
            </span>
          </Link>
          <Link
            href="/login"
            className="text-[12.5px] font-semibold text-brand-700 hover:underline"
          >
            ← Voltar para o login
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">
          {kicker}
        </div>
        <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-foreground sm:text-[32px]">
          {title}
        </h1>

        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-1.5 border-t border-brand-200 pt-4 text-[12.5px] sm:grid-cols-2">
          {meta.map((m) => (
            <div key={m.label} className="flex gap-2">
              <dt className="shrink-0 font-semibold text-text-muted">
                {m.label}
              </dt>
              <dd className="text-text-secondary">{m.value}</dd>
            </div>
          ))}
        </dl>

        <div className="legal-prose mt-10">{children}</div>
      </main>

      <footer className="border-t border-border-subtle px-5 py-8 text-center text-[12px] text-text-muted">
        MorSafe · Rafael Morgado — Fundador e Diretor · contato.morsafe.br@gmail.com
      </footer>
    </div>
  );
}

export function LegalSection({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9 first:mt-0">
      <h2 className="text-[16px] font-bold tracking-tight text-brand-900">
        {n}. {title}
      </h2>
      <div className="mt-1.5 border-t border-brand-200" />
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-text-secondary">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
