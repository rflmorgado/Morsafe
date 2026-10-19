import Link from "next/link";
import { ShieldIcon } from "@/components/brand/shield-icon";

// Landing page pública da MorSafe (rota "/", fora do grupo (app) — ver
// PUBLIC_PATHS em src/lib/supabase/middleware.ts). Texto genérico de
// propósito, igual ao resto do app (ver layout.tsx): nada aqui cita
// ViniPlast/Vinitrade, porque esse link é compartilhado com qualquer
// empresa cliente nova.

const CONTATO_EMAIL = "contato.morsafe.br@gmail.com";
const CONTATO_TELEFONE = "(11) 94776-6392";

const NAV_LINKS = [
  { href: "#beneficios", label: "Benefícios" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#contato", label: "Contato" },
];

const RISCOS = [
  {
    titulo: "A ficha de EPI é documento obrigatório",
    texto:
      "A NR-06 exige que o empregador mantenha registro de entrega de EPI a cada colaborador. Em papel ou em planilha solta, esse registro se perde, fica incompleto ou simplesmente não existe quando é pedido.",
  },
  {
    titulo: "C.A. vence — e raramente alguém lembra",
    texto:
      "Cada Certificado de Aprovação tem validade própria. Sem um lugar central acompanhando isso por equipamento, o vencimento só aparece depois que já virou um problema.",
  },
  {
    titulo: "Fiscalização pede histórico, não uma foto do caderno",
    texto:
      "Numa fiscalização ou ação trabalhista, o que vale é conseguir mostrar quem recebeu o quê, quando, com assinatura — não reconstruir isso de memória.",
  },
];

const FUNCIONALIDADES = [
  {
    icone: IconDocumentoCheck,
    titulo: "Entregas e devoluções registradas",
    texto:
      "Cada entrega, troca, devolução ou recusa de EPI fica registrada com data, colaborador e responsável — nunca editada ou apagada depois.",
  },
  {
    icone: IconRelogio,
    titulo: "Vencimento de C.A. monitorado",
    texto:
      "Os Certificados de Aprovação de cada equipamento ficam cadastrados e acompanhados, para o vencimento não pegar a empresa de surpresa.",
  },
  {
    icone: IconTrilha,
    titulo: "Trilha de auditoria imutável",
    texto:
      "Toda ação relevante no sistema é registrada numa trilha de auditoria própria — a mesma que sustenta o histórico mostrado numa fiscalização.",
  },
  {
    icone: IconAssinatura,
    titulo: "Assinatura eletrônica na ponta",
    texto:
      "Uma estação fixada no ponto de entrega (tablet ou celular da empresa) coleta a confirmação do colaborador no momento da entrega, sem depender de papel.",
  },
  {
    icone: IconVerificar,
    titulo: "Verificação pública de documento",
    texto:
      "Cada Ficha de EPI emitida carrega um código de verificação que confirma sua autenticidade — útil para auditores, peritos e fiscais.",
  },
  {
    icone: IconEmpresas,
    titulo: "Multiempresa, com dados isolados",
    texto:
      "Cada empresa cliente acessa só os próprios dados: o isolamento é garantido por política de segurança em nível de linha (RLS) no banco de dados.",
  },
];

const PASSOS = [
  {
    numero: "1",
    titulo: "Cadastro da empresa",
    texto:
      "A MorSafe cria o acesso da sua empresa e um checklist simples reúne os dados iniciais — setores, cargos e o que a empresa já usa de EPI.",
  },
  {
    numero: "2",
    titulo: "Colaboradores, setores e EPIs",
    texto:
      "Cada colaborador é cadastrado no seu setor e cargo, e os EPIs ficam vinculados ao C.A. e à validade de cada um.",
  },
  {
    numero: "3",
    titulo: "Entrega com assinatura",
    texto:
      "No momento da entrega, o colaborador confirma o recebimento — pela estação de assinatura ou direto no sistema — e o registro fica gravado.",
  },
  {
    numero: "4",
    titulo: "Relatórios e alertas",
    texto:
      "A empresa acompanha vencimentos de C.A., pendências de entrega e tira relatórios de conformidade com a NR-06 quando precisar.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-surface">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-7 w-7" />
            <span className="text-[15px] font-bold tracking-tight text-foreground">
              MorSafe
            </span>
          </div>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[13.5px] font-medium text-text-secondary hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <Link
            href="/login"
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
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(255,255,255,0.9) 0px, rgba(255,255,255,0.9) 2px, transparent 2px, transparent 34px)",
            maskImage:
              "linear-gradient(115deg, black 0%, black 35%, transparent 72%)",
            WebkitMaskImage:
              "linear-gradient(115deg, black 0%, black 35%, transparent 72%)",
          }}
        />
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-brand-700/30 blur-3xl"
        />

        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-200">
            Gestão de EPI · Conformidade NR-06
          </div>

          <h1 className="mt-5 max-w-3xl text-[34px] font-bold leading-[1.08] tracking-tight text-white sm:text-[48px] lg:text-[56px]">
            Nenhuma entrega de EPI sem registro. Nenhum C.A. vencido sem
            aviso.
          </h1>

          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-brand-100/90 sm:text-[18px]">
            A MorSafe centraliza o controle de Equipamentos de Proteção
            Individual da sua empresa — cadastro, entrega assinada e
            vencimento de C.A. — para a conformidade com a NR-06 acontecer
            sem esforço manual.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={`mailto:${CONTATO_EMAIL}?subject=${encodeURIComponent(
                "Quero conhecer a MorSafe",
              )}`}
              className="rounded-lg bg-white px-5 py-2.5 text-[13.5px] font-semibold text-brand-900 shadow-btn hover:bg-brand-50"
            >
              Falar com a MorSafe
            </a>
            <a
              href="#como-funciona"
              className="rounded-lg border border-white/25 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:border-white/50"
            >
              Ver como funciona
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-brand-200/80">
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

      {/* ===== Riscos ===== */}
      <section className="border-b border-border-subtle bg-surface-muted">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">
              O problema que o controle manual não resolve
            </div>
            <h2 className="mt-1.5 text-[26px] font-bold tracking-tight text-foreground sm:text-[30px]">
              Papel e planilha funcionam — até o dia em que precisam provar
              algo
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {RISCOS.map((item) => (
              <div
                key={item.titulo}
                className="rounded-xl border border-border-subtle bg-surface p-5 shadow-card"
              >
                <h3 className="text-[15px] font-bold tracking-tight text-foreground">
                  {item.titulo}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">
                  {item.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Funcionalidades ===== */}
      <section id="beneficios" className="bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">
              O que a MorSafe controla
            </div>
            <h2 className="mt-1.5 text-[26px] font-bold tracking-tight text-foreground sm:text-[30px]">
              Tudo o que a conformidade com a NR-06 exige, num só lugar
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FUNCIONALIDADES.map((item) => (
              <div
                key={item.titulo}
                className="rounded-xl border border-border-subtle bg-surface p-5"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <item.icone className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-[14.5px] font-bold tracking-tight text-foreground">
                  {item.titulo}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
                  {item.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Como funciona ===== */}
      <section id="como-funciona" className="border-t border-border-subtle bg-surface-muted">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">
              Como funciona
            </div>
            <h2 className="mt-1.5 text-[26px] font-bold tracking-tight text-foreground sm:text-[30px]">
              Do cadastro à primeira entrega assinada
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map((passo, i) => (
              <div key={passo.numero} className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-[14px] font-bold text-white shadow-btn">
                  {passo.numero}
                </div>
                <h3 className="mt-4 text-[14.5px] font-bold tracking-tight text-foreground">
                  {passo.titulo}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
                  {passo.texto}
                </p>
                {i < PASSOS.length - 1 && (
                  <div className="absolute right-[-18px] top-4 hidden h-px w-9 bg-border-strong lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Segurança / compliance ===== */}
      <section id="seguranca" className="border-t border-border-subtle bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">
                Segurança e privacidade
              </div>
              <h2 className="mt-1.5 text-[26px] font-bold tracking-tight text-foreground sm:text-[30px]">
                Dados tratados com a mesma seriedade do registro que eles
                sustentam
              </h2>
              <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-text-secondary">
                Cada empresa cliente acessa exclusivamente os próprios dados
                — o isolamento é garantido tecnicamente por políticas de
                segurança em nível de linha (Row Level Security) no banco de
                dados, tráfego criptografado e trilha de auditoria de toda
                ação relevante na plataforma.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/termos-de-uso"
                  className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-[13px] font-semibold text-foreground hover:border-brand-500 hover:text-brand-700"
                >
                  <IconDocumentoCheck className="h-4 w-4" />
                  Termos de Uso
                </Link>
                <Link
                  href="/politica-de-privacidade"
                  className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-[13px] font-semibold text-foreground hover:border-brand-500 hover:text-brand-700"
                >
                  <img
                    src="/brand/icon-privacidade.png"
                    alt=""
                    className="h-4 w-4 object-contain"
                  />
                  Política de Privacidade
                </Link>
                <Link
                  href="/seguranca-da-informacao"
                  className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-[13px] font-semibold text-foreground hover:border-brand-500 hover:text-brand-700"
                >
                  <img
                    src="/brand/icon-seguranca.png"
                    alt=""
                    className="h-4 w-4 object-contain"
                  />
                  Segurança da Informação
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-brand-200 bg-brand-50 p-6">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-brand-800">
                Em resumo
              </h3>
              <ul className="mt-4 space-y-3">
                {[
                  "Isolamento lógico dos dados por empresa cliente",
                  "Controle de acesso por papel de usuário",
                  "Tráfego criptografado (HTTPS/TLS)",
                  "Trilha de auditoria imutável das ações na plataforma",
                  "Em conformidade com a LGPD (Lei nº 13.709/2018)",
                ].map((texto) => (
                  <li key={texto} className="flex gap-2.5 text-[13.5px] text-brand-900">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                    <span>{texto}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA final ===== */}
      <section id="contato" className="relative overflow-hidden bg-brand-700">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(255,255,255,0.9) 0px, rgba(255,255,255,0.9) 2px, transparent 2px, transparent 34px)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-16 text-center sm:py-20">
          <h2 className="text-[26px] font-bold tracking-tight text-white sm:text-[32px]">
            Pronto para tirar o controle de EPI do papel?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed text-brand-50/90">
            Fale com a MorSafe e veja como fica o controle de entrega, C.A. e
            conformidade da sua empresa com a NR-06.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`mailto:${CONTATO_EMAIL}?subject=${encodeURIComponent(
                "Quero conhecer a MorSafe",
              )}`}
              className="rounded-lg bg-white px-5 py-2.5 text-[13.5px] font-semibold text-brand-800 shadow-btn hover:bg-brand-50"
            >
              {CONTATO_EMAIL}
            </a>
            <span className="text-[13.5px] font-semibold text-brand-50/90">
              {CONTATO_TELEFONE}
            </span>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border-subtle bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-6 w-6" />
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
            <Link href="/login" className="hover:text-brand-700">
              Entrar
            </Link>
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

function IconDocumentoCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M9 14l2 2 4-4"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRelogio({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrilha({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 5h10a4 4 0 010 8H9a4 4 0 000 8h10"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="5" r="1.4" fill="currentColor" />
      <circle cx="19" cy="21" r="1.4" fill="currentColor" />
    </svg>
  );
}

function IconAssinatura({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 17c2-3 3-5 4.5-5s1.5 3 3 3 2-4 4-4 1.5 2.5 3.5 2.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 20h16" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function IconVerificar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconEmpresas({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 21V9l6-4 6 4v12"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 21v-6h6v6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 10.5h.01M9 14h.01" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}
