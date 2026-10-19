import Link from "next/link";
import { ShieldIcon } from "@/components/brand/shield-icon";

// Landing page pública da MorSafe (rota "/", fora do grupo (app) — ver
// PUBLIC_PATHS em src/lib/supabase/middleware.ts). Texto genérico de
// propósito, igual ao resto do app (ver layout.tsx): nada aqui cita
// ViniPlast/Vinitrade, porque esse link é compartilhado com qualquer
// empresa cliente nova.
//
// Tela de boas-vindas (reformulada em 19/10/2026, a pedido do Rafael) — não
// é mais uma landing page de vendas com várias seções (riscos, grade de
// funcionalidades, passo a passo, bloco de segurança): é só logo, frase
// institucional, um texto curto de boas-vindas explicando a MorSafe e um
// convite pra entrar ou falar com a MorSafe. A frase "Protegendo pessoas.
// Comprovando conformidade." é a mesma já usada no cabeçalho da Ficha de
// EPI e do Relatório de Auditoria em PDF (ver colaboradores/[id]/ficha/
// route.ts e auditoria/relatorio/route.ts) — mantém a marca consistente
// entre o site e os documentos oficiais.

const CONTATO_EMAIL = "contato.morsafe.br@gmail.com";
const CONTATO_TELEFONE = "(11) 94776-6392";
const TAGLINE = "Protegendo pessoas. Comprovando conformidade.";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-surface">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {/* Selo com fundo escuro atrás do escudo: o PNG oficial
                (public/brand/shield.png) é um silhueta branca com fundo
                transparente — sobre o header claro (bg-surface) ele ficava
                invisível (branco sobre branco). Mesmo selo circular usado
                no cabeçalho da Ficha de EPI e do Relatório em PDF. */}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-950">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <span className="text-[15px] font-bold tracking-tight text-foreground">
              MorSafe
            </span>
          </div>

          <Link
            href="/login"
            className="rounded-lg border border-border-strong px-4 py-2 text-[13px] font-semibold text-foreground hover:border-brand-500 hover:text-brand-700"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* ===== Boas-vindas ===== */}
      <section className="relative flex flex-1 items-center overflow-hidden bg-brand-950">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(255,255,255,0.9) 0px, rgba(255,255,255,0.9) 2px, transparent 2px, transparent 34px)",
            maskImage:
              "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
            WebkitMaskImage:
              "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
          }}
        />
        <div
          aria-hidden
          className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-brand-700/30 blur-3xl"
        />

        <div className="relative mx-auto flex max-w-2xl flex-col items-center px-5 py-20 text-center sm:py-28">
          {/* Logo oficial em destaque, sobre o fundo escuro — não precisa do
              selo circular aqui, a cor branca já tem contraste de sobra. */}
          <ShieldIcon className="h-16 w-16 sm:h-20 sm:w-20" />

          <h1 className="mt-6 text-[30px] font-bold tracking-tight text-white sm:text-[38px]">
            MorSafe
          </h1>
          <p className="mt-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-brand-200 sm:text-[14px]">
            {TAGLINE}
          </p>

          <p className="mt-8 max-w-xl text-[15.5px] leading-relaxed text-brand-100/90 sm:text-[17px]">
            Bem-vindo à MorSafe — a plataforma que centraliza a gestão de
            Equipamentos de Proteção Individual (EPI) da sua empresa:
            cadastro, entrega assinada eletronicamente e acompanhamento do
            vencimento de cada Certificado de Aprovação (C.A.), para a
            conformidade com a NR-06 acontecer sem esforço manual.
          </p>
          <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-brand-100/90 sm:text-[17px]">
            Cada entrega, devolução e recusa fica registrada numa trilha de
            auditoria imutável — pronta para ser apresentada numa
            fiscalização ou numa ação trabalhista, sem precisar reconstruir
            nada de memória.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-white px-6 py-2.5 text-[13.5px] font-semibold text-brand-900 shadow-btn hover:bg-brand-50"
            >
              Entrar
            </Link>
            <a
              href={`mailto:${CONTATO_EMAIL}?subject=${encodeURIComponent(
                "Quero conhecer a MorSafe",
              )}`}
              className="rounded-lg border border-white/25 px-6 py-2.5 text-[13.5px] font-semibold text-white hover:border-white/50"
            >
              Falar com a MorSafe
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-brand-200/80">
            <span className="inline-flex items-center gap-1.5">
              <IconCheck className="h-3.5 w-3.5" /> Dados isolados por empresa
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconCheck className="h-3.5 w-3.5" /> Conformidade com a LGPD
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconCheck className="h-3.5 w-3.5" /> Alinhado à NR-06
            </span>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border-subtle bg-surface">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-5 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-950">
              <ShieldIcon className="h-4.5 w-4.5" />
            </span>
            <span className="text-[14px] font-bold tracking-tight text-foreground">
              MorSafe
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-[12.5px] text-text-secondary">
            <Link href="/termos-de-uso" className="hover:text-brand-700">
              Termos de Uso
            </Link>
            <Link href="/politica-de-privacidade" className="hover:text-brand-700">
              Política de Privacidade
            </Link>
            <Link href="/seguranca-da-informacao" className="hover:text-brand-700">
              Segurança da Informação
            </Link>
            <a
              href={`mailto:${CONTATO_EMAIL}`}
              className="hover:text-brand-700"
            >
              {CONTATO_EMAIL}
            </a>
            <span>{CONTATO_TELEFONE}</span>
          </div>

          <div className="text-[12px] text-text-muted">
            © {new Date().getFullYear()} MorSafe · Rafael Morgado — Fundador
            e Diretor
          </div>
        </div>
      </footer>
    </div>
  );
}

// ===== Ícones (SVG inline, sem dependência externa) =====

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
