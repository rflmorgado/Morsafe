import Link from "next/link";
import { ShieldIcon } from "@/components/brand/shield-icon";
import {
  PLANO_LABEL,
  PLANO_VALOR_MENSAL,
  PLANO_LIMITE_COLABORADORES,
  PLANOS_ORDENADOS,
  TAXA_IMPLANTACAO,
  formatValorPlano,
} from "@/lib/data/planos";

// Landing page pública da MorSafe (rota "/", fora do grupo (app) — ver
// PUBLIC_PATHS em src/lib/supabase/middleware.ts). Reconstruída em
// 19/10/2026 a pedido do Rafael, no padrão de site SaaS que ele mandou como
// referência (navbar + hero com mockup, seção "por que", grade de 6
// funcionalidades, planos, como funciona, FAQ, CTA final) — ver resumo da
// conversa pra entender por que a versão anterior (mais enxuta, estilo
// "boas-vindas") foi substituída: aquela virou a tela /entrar, DENTRO do
// app, antes do login; esta aqui é o site de divulgação de verdade.
//
// Duas decisões comerciais importantes, confirmadas com o Rafael antes de
// escrever isto (ele NÃO tem trial grátis — toda empresa nova paga a taxa
// de implantação na hora, ver TAXA_IMPLANTACAO — e o site antigo de
// referência prometia "30 dias grátis", o que seria falsa promessa aqui):
//   1. CTA principal é "Falar com a gente" (WhatsApp/e-mail), nunca
//      "experimente grátis".
//   2. Os preços dos planos vêm direto de @/lib/data/planos (a mesma fonte
//      usada pelo sistema de verdade em setup-empresa e assinaturas) — não
//      estão reescritos à mão aqui, pra nunca ficarem desatualizados em
//      relação ao que o sistema realmente cobra.
// "Sem fidelidade" é afirmado abaixo porque o Rafael confirmou que é
// verdade (sem período mínimo de contrato).
//
// Sem fotografia nenhuma (os mockups das telas são recriados em
// HTML/Tailwind, não capturas de tela nem fotos de estoque) — garante que
// fica legível e nítido em qualquer tamanho de tela, e que a marca nunca
// aparece errada (ver o problema do logo redesenhado nas artes que o
// Rafael mandou, resumo da conversa).

const CONTATO_EMAIL = "contato.morsafe.br@gmail.com";
const CONTATO_TELEFONE_EXIBICAO = "(11) 94776-6392";
const WHATSAPP_URL = `https://wa.me/5511947766392?text=${encodeURIComponent(
  "Olá! Quero conhecer o MorSafe.",
)}`;
const TAGLINE = "Protegendo pessoas. Comprovando conformidade.";

const NAV_LINKS = [
  { href: "#inicio", label: "Início" },
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#planos", label: "Planos" },
  { href: "#sobre", label: "Sobre" },
  { href: "#contato", label: "Contato" },
];

const POR_QUE_CARDS = [
  {
    icon: IconShieldCheck,
    title: "Conformidade com a NR-06",
    desc: "Registros organizados e prontos para auditorias e fiscalizações.",
  },
  {
    icon: IconClock,
    title: "Economia de tempo",
    desc: "Processos mais simples e centralizados, sem planilha solta.",
  },
  {
    icon: IconChartBar,
    title: "Decisões baseadas em dados",
    desc: "Relatórios claros sobre consumo, custos e uso de EPI.",
  },
];

const FUNCIONALIDADES = [
  {
    eyebrow: "ENTREGA DE EPI",
    title: "Registro de entregas com assinatura digital.",
    desc: "Registre a entrega de EPIs com a assinatura do colaborador, diretamente no sistema ou em estações de assinatura. Tudo fica armazenado de forma segura e rastreável.",
    bullets: [
      "Registro por colaborador e setor",
      "Assinatura na entrega",
      "Histórico completo",
      "Emissão de ficha de entrega",
    ],
    mock: MockEntrega,
  },
  {
    eyebrow: "RELATÓRIOS",
    title: "Relatórios completos para facilitar sua gestão.",
    desc: "Acompanhe o consumo de EPIs, gastos, movimentações e motivos das entregas em gráficos e relatórios detalhados. Exporte em PDF e mantenha tudo organizado para consultas, auditorias e tomadas de decisão.",
    bullets: [
      "Consumo por período e por setor",
      "Gastos por tipo de EPI",
      "Entradas e saídas de estoque",
      "Relatórios em PDF",
    ],
    mock: MockRelatorios,
  },
  {
    eyebrow: "DOCUMENTAÇÃO",
    title: "Relatórios em PDF prontos para anexar.",
    desc: "Gere relatórios completos com o resumo da auditoria NR-06, consumo de EPIs, movimentações, pendências e checklist de campo. Ideais para auditorias, fiscalizações e arquivo interno.",
    bullets: [
      "Layout claro e objetivo",
      "Dados atualizados",
      "Pronto para imprimir ou anexar",
      "Evidência organizada",
    ],
    mock: MockDocumento,
  },
  {
    eyebrow: "ESTOQUE",
    title: "Controle de estoque e alertas de reposição.",
    desc: "Tenha sempre os EPIs disponíveis. O MorSafe controla o estoque, registra entradas e saídas e mostra alertas de baixo estoque, evitando a falta de itens essenciais.",
    bullets: [
      "Cadastro de EPIs homologados",
      "Entradas e saídas de estoque",
      "Alertas de reposição",
      "Controle por lote e validade",
    ],
    mock: MockEstoque,
  },
  {
    eyebrow: "AUDITORIA NR-06",
    title: "Diagnóstico completo dos seus registros.",
    desc: "Verifique o atendimento aos principais pontos da NR-06, com base nos registros do sistema e no checklist de campo. Gere um relatório consolidado com pendências e situação por setor.",
    bullets: [
      "Índice de controle dos registros",
      "Pendências por setor",
      "Checklist de campo",
      "Relatório em PDF",
    ],
    mock: MockAuditoria,
  },
  {
    eyebrow: "ACESSO E SEGURANÇA",
    title: "Simples, seguro e em qualquer dispositivo.",
    desc: "Use o MorSafe no computador, tablet ou celular. Com acesso seguro, perfis de usuário e registro de todas as ações, sua empresa tem mais controle e tranquilidade.",
    bullets: [
      "Acesso por navegador",
      "Permissões por usuário",
      "Registro de atividades",
      "Dados protegidos na nuvem",
    ],
    mock: MockDispositivos,
  },
];

const COMO_FUNCIONA = [
  {
    numero: 1,
    title: "Cadastro",
    desc: "Cadastramos sua empresa e configuramos o sistema.",
  },
  {
    numero: 2,
    title: "Implantação",
    desc: "Importamos seus colaboradores e EPIs (homologados).",
  },
  {
    numero: 3,
    title: "Treinamento",
    desc: "Capacitamos sua equipe para usar o sistema.",
  },
  {
    numero: 4,
    title: "Uso no dia a dia",
    desc: "Sua empresa já começa a registrar e controlar os EPIs.",
  },
];

const FAQ = [
  {
    q: "O MorSafe atende à NR-06?",
    a: "Sim. O sistema foi desenhado em torno dos principais pontos de controle da NR-06 — registro de entrega com assinatura, controle de C.A., histórico de movimentações e auditoria — e gera relatórios prontos para apresentar numa fiscalização.",
  },
  {
    q: "Preciso instalar algum programa?",
    a: "Não. O MorSafe funciona 100% pelo navegador, no computador, tablet ou celular — não precisa instalar nada.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Sim. Os dados da sua empresa ficam isolados dos de outras empresas clientes, com controle de acesso por usuário e conformidade com a LGPD.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim — não há fidelidade, você pode cancelar quando quiser.",
  },
  {
    q: "Tem suporte para implantação e dúvidas?",
    a: "Sim. Na implantação, ajudamos a cadastrar colaboradores e EPIs e treinamos sua equipe; depois, o suporte continua disponível para dúvidas do dia a dia.",
  },
];

export default function Home() {
  const planosComPreco = PLANOS_ORDENADOS.filter((p) => p !== "enterprise");

  return (
    <div className="flex min-h-full flex-col bg-surface">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <a href="#inicio" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-950">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <span className="text-[15px] font-bold tracking-tight text-foreground">
              MorSafe
            </span>
          </a>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[13px] font-medium text-text-secondary hover:text-brand-700"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-4">
            <Link
              href="/entrar"
              className="hidden text-[13px] font-semibold text-text-secondary hover:text-brand-700 sm:inline"
            >
              Entrar
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-brand-700 px-4 py-2 text-[13px] font-semibold text-white shadow-btn transition hover:bg-brand-800"
            >
              Falar com a gente
            </a>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section
        id="inicio"
        className="scroll-mt-16 border-b border-border-subtle bg-surface-muted"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
              Controle de EPI na prática
            </div>
            <h1 className="mt-3 text-[34px] font-bold leading-[1.1] tracking-tight text-foreground sm:text-[44px]">
              O controle de EPI da sua empresa,{" "}
              <span className="text-brand-700">sem complicação.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-text-secondary">
              Registre entregas, controle o estoque, acompanhe o uso e gere
              relatórios completos — tudo em um só sistema, pensado para a
              conformidade com a NR-06.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-brand-700 px-6 py-3 text-[13.5px] font-semibold text-white shadow-btn transition hover:bg-brand-800"
              >
                Falar com a gente →
              </a>
              <a
                href="#funcionalidades"
                className="rounded-lg border border-border-strong px-6 py-3 text-[13.5px] font-semibold text-foreground transition hover:border-brand-500 hover:text-brand-700"
              >
                Conhecer o sistema
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <IconCheck className="h-3.5 w-3.5 text-brand-600" />
                Implantação assistida
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconCheck className="h-3.5 w-3.5 text-brand-600" />
                Suporte especializado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconCheck className="h-3.5 w-3.5 text-brand-600" />
                Sem fidelidade
              </span>
            </div>
          </div>

          <MockDashboard />
        </div>
      </section>

      {/* ===== Por que o MorSafe ===== */}
      <section className="border-b border-border-subtle">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:py-20">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
              Por que o MorSafe
            </div>
            <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-[30px]">
              Mais organização, segurança e praticidade na gestão de EPIs.
            </h2>
            <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-text-secondary">
              O MorSafe foi desenvolvido para simplificar o controle de
              entrega e uso de EPIs, ajudando sua empresa a manter registros
              organizados, reduzir riscos e facilitar auditorias e
              fiscalizações.
            </p>
            <a
              href="#funcionalidades"
              className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700 hover:underline"
            >
              Conheça todas as funcionalidades →
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {POR_QUE_CARDS.map((card) => (
              <div
                key={card.title}
                className="rounded-xl border border-border-subtle bg-surface p-5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <card.icon className="h-5 w-5" />
                </span>
                <div className="mt-3.5 text-[14.5px] font-semibold text-foreground">
                  {card.title}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Funcionalidades ===== */}
      <section
        id="funcionalidades"
        className="scroll-mt-16 border-b border-border-subtle bg-surface-muted"
      >
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
          <div className="max-w-xl">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
              Funcionalidades
            </div>
            <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-[30px]">
              Tudo o que sua empresa precisa para controlar EPIs.
            </h2>
          </div>

          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-12">
            {FUNCIONALIDADES.map((f) => (
              <div key={f.eyebrow}>
                <div className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-brand-700">
                  {f.eyebrow}
                </div>
                <h3 className="mt-2 text-[17px] font-bold leading-snug text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                  {f.desc}
                </p>
                <ul className="mt-3.5 space-y-1.5">
                  {f.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-1.5 text-[12.5px] text-text-secondary"
                    >
                      <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <f.mock />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Planos ===== */}
      <section id="planos" className="scroll-mt-16 border-b border-border-subtle">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
          <div className="max-w-xl">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
              Planos
            </div>
            <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-[30px]">
              Planos para empresas de todos os tamanhos.
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-text-secondary">
              Escolha o plano que melhor se adapta ao tamanho da sua equipe.
              Todas as funcionalidades estão disponíveis em todos os planos —
              o que muda é o limite de colaboradores ativos.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {planosComPreco.map((plano) => (
              <div
                key={plano}
                className="flex flex-col rounded-xl border border-border-subtle bg-surface p-5"
              >
                <div className="text-[14px] font-bold text-foreground">
                  {PLANO_LABEL[plano]}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[26px] font-bold tracking-tight text-foreground">
                    {formatValorPlano(PLANO_VALOR_MENSAL[plano])}
                  </span>
                  <span className="text-[12.5px] text-text-muted">/mês</span>
                </div>
                <div className="mt-1 text-[12.5px] text-text-secondary">
                  Até {PLANO_LIMITE_COLABORADORES[plano]} colaboradores
                </div>
                <div className="mt-3 text-[12.5px] text-text-secondary">
                  Todas as funcionalidades inclusas
                </div>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 rounded-lg border border-border-strong px-4 py-2.5 text-center text-[13px] font-semibold text-foreground transition hover:border-brand-500 hover:text-brand-700"
                >
                  Falar com a gente
                </a>
              </div>
            ))}

            <div className="flex flex-col rounded-xl border border-border-strong bg-brand-950 p-5 text-white">
              <div className="text-[14px] font-bold">
                {PLANO_LABEL.enterprise}
              </div>
              <div className="mt-2 text-[26px] font-bold tracking-tight">
                Sob consulta
              </div>
              <div className="mt-1 text-[12.5px] text-brand-200">
                Mais de {PLANO_LIMITE_COLABORADORES.industrial} colaboradores
              </div>
              <div className="mt-3 text-[12.5px] text-brand-100/90">
                Plano personalizado para a sua operação
              </div>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 rounded-lg bg-white px-4 py-2.5 text-center text-[13px] font-semibold text-brand-900 transition hover:bg-brand-50"
              >
                Falar com um especialista
              </a>
            </div>
          </div>

          <p className="mt-6 text-[12.5px] text-text-muted">
            Taxa de implantação única de {formatValorPlano(TAXA_IMPLANTACAO)}{" "}
            na contratação, para qualquer plano. Sem fidelidade — cancele
            quando quiser.
          </p>
        </div>
      </section>

      {/* ===== Como funciona ===== */}
      <section className="border-b border-border-subtle bg-surface-muted">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
          <div className="max-w-xl">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
              Como funciona
            </div>
            <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-[30px]">
              Comece a usar o MorSafe em poucos passos.
            </h2>
          </div>

          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {COMO_FUNCIONA.map((step) => (
              <div key={step.numero}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-[13px] font-bold text-white">
                  {step.numero}
                </span>
                <div className="mt-3.5 text-[14.5px] font-semibold text-foreground">
                  {step.title}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-block rounded-lg bg-brand-700 px-6 py-3 text-[13.5px] font-semibold text-white shadow-btn transition hover:bg-brand-800"
          >
            Falar com a gente →
          </a>
        </div>
      </section>

      {/* ===== Sobre ===== */}
      <section id="sobre" className="scroll-mt-16 border-b border-border-subtle">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center lg:py-20">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
            Sobre
          </div>
          <h2 className="mt-3 text-[24px] font-bold leading-tight tracking-tight text-foreground sm:text-[28px]">
            Feito por quem entende de segurança do trabalho.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-relaxed text-text-secondary">
            O MorSafe nasceu da rotina de quem lida todos os dias com gestão
            de EPI, documentação de segurança do trabalho e conformidade com
            a NR-06 — para resolver na prática o que planilha solta não
            resolve: saber, a qualquer momento, o que foi entregue, para
            quem, quando vence e o que falta regularizar.
          </p>
          <p className="mt-5 text-[13px] font-semibold text-foreground">
            Rafael Morgado — Fundador e Diretor
          </p>
          <p className="text-[12.5px] text-text-muted">
            Técnico em Segurança do Trabalho · MTE 0066256/SP
          </p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="border-b border-border-subtle bg-surface-muted">
        <div className="mx-auto max-w-3xl px-5 py-16 lg:py-20">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
            Dúvidas frequentes
          </div>
          <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-[30px]">
            Ainda tem dúvidas?
          </h2>

          <div className="mt-8 divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-semibold text-foreground">
                  {item.q}
                  <IconChevronDown className="h-4 w-4 shrink-0 text-text-muted transition group-open:rotate-180" />
                </summary>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-secondary">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA final ===== */}
      <section
        id="contato"
        className="scroll-mt-16 bg-brand-950"
        style={{
          background:
            "radial-gradient(circle at 20% 15%, rgba(52,160,94,0.16), transparent 45%), radial-gradient(circle at 85% 85%, rgba(52,160,94,0.12), transparent 45%), var(--brand-950)",
        }}
      >
        <div className="mx-auto max-w-3xl px-5 py-16 text-center lg:py-20">
          <h2 className="text-[26px] font-bold leading-tight tracking-tight text-white sm:text-[30px]">
            Pronto para simplificar a gestão de EPIs na sua empresa?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[14.5px] leading-relaxed text-brand-100/90">
            Fale com a gente e veja na prática como o MorSafe pode ajudar a
            sua equipe.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white px-6 py-3 text-[13.5px] font-semibold text-brand-900 shadow-btn transition hover:bg-brand-50"
            >
              Falar pelo WhatsApp
            </a>
            <a
              href={`mailto:${CONTATO_EMAIL}?subject=${encodeURIComponent(
                "Quero conhecer a MorSafe",
              )}`}
              className="rounded-lg border border-white/25 px-6 py-3 text-[13.5px] font-semibold text-white hover:border-white/50"
            >
              {CONTATO_EMAIL}
            </a>
          </div>
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-200">
            {TAGLINE}
          </p>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-surface">
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
            <span>{CONTATO_TELEFONE_EXIBICAO}</span>
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

// ===== Mockups das telas (HTML/Tailwind, não são capturas de tela nem
// fotos — ver comentário no topo do arquivo sobre o motivo) =====

function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-[0_1px_2px_rgba(18,53,36,0.06),0_8px_24px_rgba(18,53,36,0.08)]">
      <div className="flex items-center gap-1.5 border-b border-border-subtle bg-surface-muted px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-danger-text/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning-text/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-brand-600/40" />
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

function MockDashboard() {
  const barras = [48, 62, 71, 68, 71, 80];
  const meses = ["Mai", "Jun", "Jul", "Ago", "Set", "Out"];
  return (
    <BrowserChrome>
      <div className="mb-3 text-[11px] font-semibold text-text-secondary">
        Dashboard
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Colaboradores ativos", value: "95" },
          { label: "EPIs entregues este mês", value: "120" },
          { label: "Pendências", value: "12", danger: true },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-border-subtle p-2.5"
          >
            <div className="text-[9.5px] leading-tight text-text-muted">
              {kpi.label}
            </div>
            <div
              className={`mt-1 text-[16px] font-bold ${kpi.danger ? "text-danger-text" : "text-foreground"}`}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-border-subtle p-2.5">
        <div className="mb-2 text-[9.5px] text-text-muted">
          Entregas nos últimos 6 meses
        </div>
        <div className="flex h-16 items-end gap-2">
          {barras.map((h, i) => (
            <div
              key={meses[i]}
              className="flex flex-1 flex-col items-center justify-end gap-1"
            >
              {/* Altura em px fixo, não em % — dentro de um flex column sem
                  altura própria definida, uma altura em % não tem contra
                  qual se resolver e o navegador trata como 0 (foi exatamente
                  o que aconteceu aqui: barras invisíveis, só os meses
                  apareciam, confirmado com screenshot do build local em
                  19/10/2026 antes de entregar). */}
              <div
                className="w-full rounded-t bg-brand-500"
                style={{ height: `${Math.round((h / 100) * 48)}px` }}
              />
              <span className="text-[8px] text-text-muted">{meses[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </BrowserChrome>
  );
}

function MockEntrega() {
  return (
    <BrowserChrome>
      <div className="text-[11px] font-semibold text-text-secondary">
        Nova entrega de EPI
      </div>
      <div className="mt-2.5 space-y-1.5">
        {["Colaborador", "Setor", "EPI", "Quantidade"].map((label) => (
          <div key={label}>
            <div className="text-[8.5px] text-text-muted">{label}</div>
            <div className="h-5 rounded border border-border-subtle" />
          </div>
        ))}
      </div>
      <div className="mt-2 text-[8.5px] text-text-muted">
        Assinatura do colaborador
      </div>
      <div className="mt-1 h-7 rounded border border-border-subtle" />
      <div className="mt-2.5 rounded bg-brand-700 py-1.5 text-center text-[9.5px] font-semibold text-white">
        Registrar entrega
      </div>
    </BrowserChrome>
  );
}

function MockRelatorios() {
  return (
    <BrowserChrome>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Entregas", value: "10" },
          { label: "Gasto total", value: "R$ 339" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border-subtle p-2">
            <div className="text-[8.5px] text-text-muted">{kpi.label}</div>
            <div className="mt-0.5 text-[13px] font-bold text-foreground">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex h-12 items-end gap-1.5 rounded-lg border border-border-subtle p-2">
        {[20, 35, 15, 40, 55, 30].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-brand-500"
            style={{ height: `${Math.round((h / 100) * 32)}px` }}
          />
        ))}
      </div>
    </BrowserChrome>
  );
}

function MockDocumento() {
  return (
    <BrowserChrome>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold text-foreground">MorSafe</div>
        <ShieldIcon className="h-3.5 w-3.5" invert />
      </div>
      <div className="mt-2 text-[10px] font-semibold text-foreground">
        Relatório de Consumo de EPI
      </div>
      <div className="mt-2 space-y-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1.5 w-full rounded bg-border-subtle" />
        ))}
        <div className="h-1.5 w-2/3 rounded bg-border-subtle" />
      </div>
    </BrowserChrome>
  );
}

function MockEstoque() {
  const linhas = [
    { epi: "Luva de látex", status: "ok" },
    { epi: "Óculos de proteção", status: "ok" },
    { epi: "Respirador PFF2", status: "danger" },
    { epi: "Capacete", status: "ok" },
  ];
  return (
    <BrowserChrome>
      <div className="text-[9px] font-semibold text-text-muted">
        EPI · Estoque · Status
      </div>
      <div className="mt-1.5 space-y-1.5">
        {linhas.map((linha) => (
          <div
            key={linha.epi}
            className="flex items-center justify-between rounded border border-border-subtle px-2 py-1"
          >
            <span className="text-[9.5px] text-foreground">{linha.epi}</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${linha.status === "danger" ? "bg-danger-text" : "bg-brand-600"}`}
            />
          </div>
        ))}
      </div>
    </BrowserChrome>
  );
}

function MockAuditoria() {
  return (
    <BrowserChrome>
      <div className="text-[11px] font-semibold text-text-secondary">
        Auditoria NR-06
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <div className="rounded-lg border border-border-subtle p-2">
          <div className="text-[8px] text-text-muted">Índice</div>
          <div className="text-[13px] font-bold text-foreground">54%</div>
        </div>
        <div className="rounded-lg border border-border-subtle p-2">
          <div className="text-[8px] text-text-muted">Atenção</div>
          <div className="text-[13px] font-bold text-warning-text">0</div>
        </div>
        <div className="rounded-lg border border-border-subtle p-2">
          <div className="text-[8px] text-text-muted">Críticos</div>
          <div className="text-[13px] font-bold text-danger-text">25</div>
        </div>
      </div>
    </BrowserChrome>
  );
}

function MockDispositivos() {
  return (
    <div className="flex items-end gap-3">
      <div className="h-20 w-28 rounded-lg border border-border-subtle bg-surface p-1.5 shadow-[0_1px_2px_rgba(18,53,36,0.06),0_8px_24px_rgba(18,53,36,0.08)]">
        <div className="h-full rounded border border-border-subtle bg-brand-950 p-1.5">
          <div className="space-y-1">
            <div className="h-1 w-3/4 rounded bg-white/40" />
            <div className="h-1 w-1/2 rounded bg-white/25" />
            <div className="h-1 w-2/3 rounded bg-white/25" />
          </div>
        </div>
      </div>
      <div className="h-24 w-12 rounded-lg border border-border-subtle bg-surface p-1 shadow-[0_1px_2px_rgba(18,53,36,0.06),0_8px_24px_rgba(18,53,36,0.08)]">
        <div className="h-full rounded border border-border-subtle bg-brand-950 p-1">
          <div className="space-y-1">
            <div className="h-1 w-full rounded bg-white/40" />
            <div className="h-1 w-2/3 rounded bg-white/25" />
          </div>
        </div>
      </div>
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

function IconShieldCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={1.6} />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChartBar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 19V10M12 19V5M19 19v-7"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
