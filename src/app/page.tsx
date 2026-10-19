import Link from "next/link";
import { ShieldIcon } from "@/components/brand/shield-icon";

// Landing page pública da MorSafe (rota "/", fora do grupo (app) — ver
// PUBLIC_PATHS em src/lib/supabase/middleware.ts). Texto genérico de
// propósito (ver layout.tsx): nada aqui cita ViniPlast/Vinitrade, porque
// esse link é compartilhado com qualquer empresa cliente nova.
//
// Reconstruída em 19/10/2026 a pedido do Rafael — agora SEPARADA da tela de
// boas-vindas do app (ver src/app/entrar/page.tsx, que fica antes do
// login): esta é a vitrine pública de vendas, com a grade de
// funcionalidades completa. O conteúdo de cada card abaixo reaproveita o
// texto que o Rafael já tinha escrito/testado num material de divulgação
// próprio (prints reais do app com legendas) — mantém a mesma mensagem,
// só reconstruído como página de verdade em vez de imagem estática (o que
// também evita carregar pro site o erro de logo que tinha nessas imagens,
// ver conversa de 19/10/2026 — aqui o logo é sempre o componente
// <ShieldIcon> oficial, nunca uma imagem solta).
//
// "Entrar" aponta pra "/entrar" (a tela de boas-vindas do app), não direto
// pra "/login" — é a porta de entrada única do app a partir de agora.

const CONTATO_EMAIL = "contato.morsafe.br@gmail.com";
const CONTATO_TELEFONE = "(11) 94776-6392";
const TAGLINE = "Protegendo pessoas. Comprovando conformidade.";

type Funcionalidade = {
  titulo: string;
  descricao: string;
  icone: (props: { className?: string }) => React.ReactElement;
};

const FUNCIONALIDADES: Funcionalidade[] = [
  {
    titulo: "Dashboard em tempo real",
    descricao:
      "Entregas, gastos, estoque, vencimentos de C.A. e situação da NR-06 — tudo num único painel, sem precisar juntar planilha nenhuma.",
    icone: IconChart,
  },
  {
    titulo: "Assinatura no ponto de coleta",
    descricao:
      "Use um tablet ou celular da própria empresa, fixado no almoxarifado, pra coletar a assinatura do colaborador no momento do registro.",
    icone: IconDevice,
  },
  {
    titulo: "Auditoria NR-06",
    descricao:
      "Diagnóstico do que está documentado + checklist do que foi observado em campo — identifique pendências críticas e registre a entrega direto da tela.",
    icone: IconClipboard,
  },
  {
    titulo: "Controle de C.A. e EPIs homologados",
    descricao:
      "Cadastro mestre de EPI com número de C.A., validade e custo médio — saiba antes de vencer, nunca depois.",
    icone: IconShieldCheck,
  },
  {
    titulo: "Estoque de EPIs",
    descricao:
      "Saldo atual por item, limite de alerta, custo médio e histórico de entradas — importação de planilha incluída.",
    icone: IconBox,
  },
  {
    titulo: "Ficha de entrega de EPI",
    descricao:
      "Histórico completo de entregas, devoluções e recusas por colaborador, com assinatura e QR Code de verificação de autenticidade.",
    icone: IconFileCheck,
  },
  {
    titulo: "Relatórios prontos para auditoria",
    descricao:
      "Consumo, gasto por setor e índice de controle dos registros — gerados na hora, em PDF, prontos pra anexar numa fiscalização.",
    icone: IconReport,
  },
  {
    titulo: "Gestão de colaboradores",
    descricao:
      "Todos os colaboradores organizados por setor, com busca, filtros e situação da NR-06 visível de cara.",
    icone: IconUsers,
  },
  {
    titulo: "Usuários e permissões",
    descricao:
      "Defina quem é administrador e quem é encarregado — controle total de quem acessa o MorSafe na sua empresa.",
    icone: IconLock,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-surface">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-950">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <span className="text-[15px] font-bold tracking-tight text-foreground">
              MorSafe
            </span>
          </div>

          <nav className="hidden items-center gap-7 text-[13.5px] font-medium text-text-secondary sm:flex">
            <a href="#funcionalidades" className="hover:text-brand-700">
              Funcionalidades
            </a>
            <a href="#seguranca" className="hover:text-brand-700">
              Segurança
            </a>
          </nav>

          <Link
            href="/entrar"
            className="rounded-lg border border-border-strong px-4 py-2 text-[13px] font-semibold text-foreground hover:border-brand-500 hover:text-brand-700"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden bg-brand-950">
        <div
          aria-hidden
          className="absolute left-1/2 top-0 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-brand-700/30 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 py-20 text-center sm:py-28">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand-200 sm:text-[13.5px]">
            {TAGLINE}
          </p>
          <h1 className="mt-4 text-[32px] font-bold leading-tight tracking-tight text-white sm:text-[44px]">
            Nenhuma entrega de EPI sem registro.
            <br />
            Nenhum C.A. vencido sem aviso.
          </h1>
          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-white/90">
            O MorSafe centraliza o controle de Equipamentos de Proteção
            Individual da sua empresa: cadastro, entrega assinada
            eletronicamente e acompanhamento de cada Certificado de
            Aprovação, pra conformidade com a NR-06 acontecer sem esforço
            manual.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/entrar"
              className="rounded-lg bg-white px-7 py-3 text-[14px] font-semibold text-brand-900 shadow-btn transition hover:bg-brand-50"
            >
              Entrar
            </Link>
            <a
              href={`mailto:${CONTATO_EMAIL}?subject=${encodeURIComponent(
                "Quero conhecer a MorSafe",
              )}`}
              className="rounded-lg border border-white/25 px-7 py-3 text-[14px] font-semibold text-white hover:border-white/50"
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

      {/* ===== Funcionalidades ===== */}
      <section id="funcionalidades" className="bg-surface py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand-700">
              Funcionalidades
            </p>
            <h2 className="mt-2 text-[26px] font-bold tracking-tight text-foreground sm:text-[32px]">
              Tudo que sua empresa precisa pra NR-06, num só lugar
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FUNCIONALIDADES.map((f) => (
              <div
                key={f.titulo}
                className="rounded-xl border border-border-subtle bg-surface p-6 transition hover:border-brand-200 hover:shadow-[0_4px_16px_rgba(18,53,36,0.06)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <f.icone className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-foreground">
                  {f.titulo}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
                  {f.descricao}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Segurança ===== */}
      <section id="seguranca" className="border-t border-border-subtle bg-surface-muted py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand-700">
              Segurança da informação
            </p>
            <h2 className="mt-2 text-[26px] font-bold tracking-tight text-foreground sm:text-[32px]">
              Seus dados, isolados e protegidos
            </h2>
            <p className="mt-4 max-w-lg text-[14.5px] leading-relaxed text-text-secondary">
              Cada empresa cliente enxerga só os próprios dados — nunca os de
              outra empresa cadastrada no MorSafe. Toda entrega, devolução e
              recusa fica registrada numa trilha de auditoria imutável,
              pronta pra uma fiscalização ou ação trabalhista, sem precisar
              reconstruir nada de memória.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SeloSeguranca
              icone={IconLock}
              titulo="Isolamento por empresa"
              descricao="Cada cliente só acessa os próprios dados."
            />
            <SeloSeguranca
              icone={IconShieldCheck}
              titulo="Conformidade com a LGPD"
              descricao="Dados pessoais tratados com a base legal correta."
            />
            <SeloSeguranca
              icone={IconClipboard}
              titulo="Alinhado à NR-06"
              descricao="Registro pensado pra atender a norma na prática."
            />
          </div>
        </div>
      </section>

      {/* ===== CTA final ===== */}
      <section className="bg-brand-700">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-5 py-16 text-center">
          <h2 className="text-[24px] font-bold tracking-tight text-white sm:text-[28px]">
            Pronto pra colocar sua empresa em dia com a NR-06?
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/entrar"
              className="rounded-lg bg-white px-7 py-3 text-[14px] font-semibold text-brand-900 shadow-btn hover:bg-brand-50"
            >
              Entrar
            </Link>
            <a
              href={`mailto:${CONTATO_EMAIL}?subject=${encodeURIComponent(
                "Quero conhecer a MorSafe",
              )}`}
              className="rounded-lg border border-white/30 px-7 py-3 text-[14px] font-semibold text-white hover:border-white/60"
            >
              Falar com a MorSafe
            </a>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border-subtle bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
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
            <a href={`mailto:${CONTATO_EMAIL}`} className="hover:text-brand-700">
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

// ===== Componentes auxiliares =====

function SeloSeguranca({
  icone: Icone,
  titulo,
  descricao,
}: {
  icone: (props: { className?: string }) => React.ReactElement;
  titulo: string;
  descricao: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icone className="h-4.5 w-4.5" />
      </span>
      <h3 className="mt-3 text-[13.5px] font-semibold text-foreground">
        {titulo}
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
        {descricao}
      </p>
    </div>
  );
}

// ===== Ícones (SVG inline, sem dependência externa) =====

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDevice({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="6" y="2" width="12" height="20" rx="2" stroke="currentColor" strokeWidth={2} />
      <path d="M11 18h2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth={2} />
      <path d="M9 3h6v3H9z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconShieldCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBox({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 7l9-4 9 4-9 4-9-4z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M3 7v10l9 4 9-4V7" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M12 11v10" stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}

function IconFileCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M9 14l2 2 4-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconReport({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4" y="4" width="16" height="17" rx="2" stroke="currentColor" strokeWidth={2} />
      <path d="M8 16v-3M12 16v-6M16 16v-1" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth={2} />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M16 4.5a3 3 0 010 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M15 14.2c2.3.6 4 2.7 4 5.3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth={2} />
      <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
