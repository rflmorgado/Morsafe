import Image from "next/image";
import Link from "next/link";
import { ShieldIcon } from "@/components/brand/shield-icon";
import { MoraWidget } from "@/components/mora/mora-widget";
import { MobileNav } from "@/components/landing/mobile-nav";
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
// Atualização de 19/10/2026 — a pedido do Rafael ("vc não consegue colocar
// algumas fotos das telas reais... para o pessoal ver de verdade como é
// cada tela" + "vamos evidenciar algumas coisas com mais impacto, nossos
// diferenciais"), a seção de funcionalidades trocou os mockups desenhados
// em HTML/Tailwind por CAPTURAS REAIS do sistema (public/marketing/*.webp).
// Os mockups desenhados em HTML/Tailwind (BrowserChrome, MockDashboard
// etc.) foram removidos — ver histórico do git se precisar recuperá-los.
//
// Atualização de 20/10/2026 — Rafael reclamou do formato das capturas da
// atualização acima ("de lado, cortando dados", layout não ficou bonito) e
// mandou um conjunto novo: composições premium em "janela flutuante" sobre
// o fundo verde da marca + padrão de pontos (não são mais recortes crus de
// tela — a arte ao redor da janela agora é intencional e aprovada por ele,
// diferente das artes com logo errado da rodada anterior). Junto com esse
// conjunto ele pediu explicitamente para MANTER os e-mails visíveis nas
// imagens (ao contrário da rodada anterior, em que o e-mail pessoal dele
// tinha sido borrado) — não voltar a borrar sem ele pedir de novo. Também
// pediu pra separar Movimentações e Ficha de Entrega de EPI (antes uma
// imagem só, sobrepondo as duas janelas) em duas seções evidenciadas
// separadamente, e acrescentar Colaboradores e EPIs homologados, que
// faltavam. A estrutura ficou: 6 seções grandes alternadas (FUNCIONALIDADES,
// a jornada principal) + uma grade "Gestão do dia a dia" logo depois
// (GESTAO_DIA_A_DIA) com Colaboradores, EPIs homologados, Estoque e
// Usuários, pra não virar uma página de 10 seções gigantes repetidas.
//
// Atualização de 21/10/2026 — selo "Criado por um Técnico em Segurança do
// Trabalho" (public/brand/selo-tecnico-seguranca.png) adicionado no canto
// superior direito da imagem do hero, a pedido do Rafael — reforça logo de
// cara que o produto foi feito por quem tem registro profissional na área
// (MTE 0066256/SP), não só por uma empresa de software genérica.
//
// Ajuste do mesmo dia — Rafael achou o selo "flutuando" acima do mockup
// (deslocamento negativo grande demais, sobrando fundo cinza da seção
// acima da foto) e o texto pouco legível. Correções: (1) o PNG do selo foi
// reprocessado com um recorte bem mais justo ao redor do cartão verde (o
// corte antigo mantinha quase toda a tela quadrada original por causa do
// degradê suave da sombra, então o "selo de verdade" ocupava uma fração
// pequena da imagem e ficava minúsculo/ilegível quando reduzido); (2) o
// deslocamento negativo (-right/-top) foi reduzido para o selo ficar
// predominantemente DENTRO da foto, como um adesivo colado de verdade, não
// pairando acima dela; (3) o tamanho em cada breakpoint foi aumentado.
//
// Segundo ajuste do mesmo dia — a primeira remoção de fundo usava
// "distância da cor branca" pixel a pixel pra decidir o que virava
// transparente, e isso também deixava o TEXTO branco do selo (mesma cor
// clara do fundo) parcialmente transparente, vazando o fundo da página por
// trás das letras e tornando o texto quase ilegível quando ampliado — não
// era corte, era transparência indevida no texto. Reprocessado com
// flood-fill a partir da borda da imagem (só o fundo de verdade, conectado
// à borda, vira transparente; qualquer área clara isolada no interior,
// como o texto, continua 100% opaca). Arquivo trocado de nome
// (selo-tecnico-seguranca.png → selo-tecnico-seguranca-v2.png) de
// propósito, só pra forçar o cache da Vercel/navegador a buscar a versão
// nova em vez de servir a imagem antiga com o mesmo nome.

const CONTATO_EMAIL = "contato.morsafe.br@gmail.com";
const CONTATO_TELEFONE_EXIBICAO = "(11) 92750-0869";
const WHATSAPP_URL = `https://wa.me/5511927500869?text=${encodeURIComponent(
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
  {
    icon: IconFolderSearch,
    title: "Tudo em um só lugar",
    desc: "Entregas, estoque, auditoria e documentos no mesmo sistema — sem pastas soltas nem planilha paralela para encontrar o que precisa.",
  },
];

// Conjunto de imagens renovado em 20/10/2026 a pedido do Rafael — composições
// "janela flutuante" sobre o fundo verde da marca (não são mais capturas de
// tela cruas). As 6 abaixo contam a jornada principal do sistema, da entrega
// até o relatório; o restante das telas (Colaboradores, EPIs homologados,
// Estoque, Usuários) está na grade "Gestão do dia a dia" logo depois.
const FUNCIONALIDADES = [
  {
    eyebrow: "VISÃO GERAL",
    title: "O dia a dia da operação em um único painel.",
    desc: "Entregas do mês, gastos, EPIs com estoque baixo e CAs vencendo — tudo visível assim que você entra no sistema, sem precisar caçar informação em telas diferentes.",
    bullets: [
      "Indicadores do mês em destaque",
      "Situação do NR-06 e do estoque",
      "Alertas e ações rápidas",
      "Entregas dos últimos 6 meses",
    ],
    image: "/marketing/dashboard-visao-operacao.webp",
    imageAlt:
      "Tela real do MorSafe mostrando o dashboard, com entregas do mês, situação do NR-06, do estoque e gasto por setor",
    imageWidth: 1448,
    imageHeight: 1086,
  },
  {
    eyebrow: "ENTREGA DE EPI",
    title: "Registro de entregas com assinatura digital.",
    desc: "Registre a entrega de EPIs com a assinatura do colaborador, diretamente no sistema ou em estações de assinatura fixas no ponto de entrega. Tudo fica armazenado de forma segura e rastreável.",
    bullets: [
      "Registro por colaborador e setor",
      "Assinatura no momento da entrega",
      "Estações de assinatura dedicadas",
      "Histórico completo e rastreável",
    ],
    image: "/marketing/estacoes-assinatura.webp",
    imageAlt:
      "Tela real do MorSafe mostrando as estações de assinatura, usadas para coletar a assinatura do colaborador no ponto de entrega",
    imageWidth: 1448,
    imageHeight: 1086,
  },
  {
    eyebrow: "MOVIMENTAÇÕES",
    title: "Histórico completo de entregas, devoluções e recusas.",
    desc: "Cada entrega, devolução ou recusa de EPI fica registrada com data, motivo e responsável — do mais recente ao mais antigo, sempre disponível para consulta ou exportação.",
    bullets: [
      "Entregas, devoluções e recusas",
      "Filtro por colaborador, EPI e período",
      "Motivo de cada movimentação",
      "Exportação em CSV",
    ],
    image: "/marketing/historico-movimentacoes.webp",
    imageAlt:
      "Tela real do MorSafe mostrando o histórico de movimentações, com entregas, devoluções e recusas de EPI",
    imageWidth: 1448,
    imageHeight: 1086,
  },
  {
    eyebrow: "DOCUMENTAÇÃO",
    title: "Ficha de entrega gerada automaticamente, pronta para assinar.",
    desc: "A cada entrega, o MorSafe gera a Ficha de Entrega de EPI com o termo de responsabilidade, o histórico do colaborador e um QR Code de verificação — pronta para imprimir, assinar ou anexar numa fiscalização.",
    bullets: [
      "Termo de responsabilidade NR-06",
      "Histórico de entregas do colaborador",
      "Verificação por QR Code",
      "Pronta para imprimir ou anexar",
    ],
    image: "/marketing/ficha-entrega-epi.webp",
    imageAlt:
      "Tela real do MorSafe mostrando a Ficha de Entrega de EPI em PDF, com termo de responsabilidade e QR Code de verificação",
    imageWidth: 758,
    imageHeight: 1086,
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
    image: "/marketing/auditoria-visao-geral.webp",
    imageAlt:
      "Tela real do MorSafe mostrando o diagnóstico de auditoria NR-06, com índice de controle, pendências e raio-x dos controles",
    imageWidth: 1448,
    imageHeight: 1086,
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
    image: "/marketing/relatorios-dados-decisao.webp",
    imageAlt:
      "Tela real do MorSafe mostrando os relatórios de consumo, gasto por mês e consumo por unidade de proteção",
    imageWidth: 1448,
    imageHeight: 1086,
  },
];

// Grade secundária — telas de gestão e cadastro que complementam a jornada
// principal acima. Adicionada em 20/10/2026 junto com Colaboradores e EPIs
// homologados, que faltavam no site.
const GESTAO_DIA_A_DIA = [
  {
    title: "Colaboradores",
    desc: "Lista completa com busca rápida, filtro por setor, status e situação da NR-06 — com importação em planilha para cadastrar todo mundo de uma vez.",
    image: "/marketing/gestao-colaboradores.webp",
    imageAlt:
      "Tela real do MorSafe mostrando a lista de colaboradores, com setor, cargo, status e situação da NR-06",
    imageWidth: 1448,
    imageHeight: 1086,
  },
  {
    title: "EPIs homologados",
    desc: "Cadastro mestre dos EPIs homologados pela empresa, com número e validade do C.A., tipo de proteção e custo médio — a base de tudo que o sistema controla.",
    image: "/marketing/gestao-epis.webp",
    imageAlt:
      "Tela real do MorSafe mostrando o cadastro de EPIs homologados, com C.A., tipo e custo médio",
    imageWidth: 1448,
    imageHeight: 1086,
  },
  {
    title: "Estoque",
    desc: "Saldo atual por EPI, histórico de compras e alertas de reposição — para os itens essenciais nunca faltarem no almoxarifado.",
    image: "/marketing/controle-estoque.webp",
    imageAlt:
      "Tela real do MorSafe mostrando o controle de estoque de EPIs, com saldo atual, limite de alerta e custo médio",
    imageWidth: 1448,
    imageHeight: 1086,
  },
  {
    title: "Usuários",
    desc: "Defina quem tem acesso ao MorSafe na sua empresa, com papéis de Admin e Encarregado e registro de todas as ações.",
    image: "/marketing/controle-usuarios.webp",
    imageAlt:
      "Tela real do MorSafe mostrando o gerenciamento de usuários, com papéis de Admin e Encarregado",
    imageWidth: 1680,
    imageHeight: 840,
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
            <MobileNav />
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

          <div className="relative">
            <Image
              src="/marketing/hero-dashboard.webp"
              alt="Painel do MorSafe mostrando entregas do mês, situação do estoque, auditoria NR-06 e gasto por setor"
              width={1400}
              height={933}
              priority
              className="h-auto w-full rounded-2xl shadow-[0_1px_2px_rgba(18,53,36,0.06),0_16px_40px_rgba(18,53,36,0.14)]"
            />
            {/* Selo "Criado por um Técnico em Segurança do Trabalho" — ver
                notas de 21/10/2026 no topo do arquivo. Sobreposto no canto
                superior direito do mockup, como um adesivo colado nele
                (deslocamento negativo pequeno, maior parte do selo dentro
                da foto), sem cortar em telas pequenas (escala junto com o
                breakpoint). PNG com recorte justo (sem sobra de fundo
                transparente ao redor) para ficar legível mesmo pequeno. */}
            <Image
              src="/brand/selo-tecnico-seguranca-v2.png"
              alt="Selo: criado por um Técnico em Segurança do Trabalho registrado — MTE 0066256/SP"
              width={1141}
              height={1092}
              className="absolute -right-2 -top-2 h-auto w-24 drop-shadow-lg sm:-right-3 sm:-top-3 sm:w-32 lg:-right-4 lg:-top-4 lg:w-40"
            />
          </div>
        </div>
      </section>

      {/* ===== Vídeo institucional =====
          Adicionado em 20/10/2026 a pedido do Rafael — resumo em vídeo (~20s)
          montado a partir das mesmas capturas reais de tela já usadas nas
          seções de Funcionalidades abaixo, com trilha original composta do
          zero (sem música de terceiros, sem questão de licenciamento). */}
      <section className="border-b border-border-subtle">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center lg:py-20">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
            Veja na prática
          </div>
          <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-[30px]">
            Um resumo em vídeo do MorSafe por dentro.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-relaxed text-text-secondary">
            As principais telas do sistema em menos de meio minuto — da
            entrega de EPI com assinatura digital até a auditoria NR-06.
          </p>

          <div className="relative mx-auto mt-10 max-w-3xl overflow-hidden rounded-2xl border border-border-subtle shadow-[0_1px_2px_rgba(18,53,36,0.06),0_16px_40px_rgba(18,53,36,0.14)]">
            <video
              controls
              preload="metadata"
              poster="/video/morsafe-institucional-poster.jpg"
              width={1920}
              height={1080}
              className="h-auto w-full bg-brand-950"
            >
              <source src="/video/morsafe-institucional.mp4" type="video/mp4" />
              Seu navegador não suporta vídeo HTML5.
            </video>
          </div>

          <a
            href="/tour"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-3 text-[13.5px] font-semibold text-white shadow-btn transition hover:bg-brand-800"
          >
            Explorar as telas você mesmo →
          </a>
        </div>
      </section>

      {/* ===== Por que o MorSafe ===== */}
      <section className="border-b border-border-subtle">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:py-20">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
              Diferenciais
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

          <div className="grid gap-4 sm:grid-cols-2">
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
              Veja o MorSafe por dentro — direto da tela real do sistema.
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-text-secondary">
              Sem ilustração nem protótipo: as imagens abaixo são capturas
              reais das telas do MorSafe em uso, da entrega de EPI com
              assinatura digital até o relatório pronto para auditoria.
            </p>
          </div>

          <div className="mt-12 flex flex-col gap-16 lg:gap-20">
            {FUNCIONALIDADES.map((f, i) => (
              <div
                key={f.eyebrow}
                className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
              >
                <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-brand-700">
                    {f.eyebrow}
                  </div>
                  <h3 className="mt-2 text-[21px] font-bold leading-snug tracking-tight text-foreground sm:text-[24px]">
                    {f.title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">
                    {f.desc}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {f.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2 text-[13.5px] text-text-secondary"
                      >
                        <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                  <div className="overflow-hidden rounded-2xl shadow-[0_1px_2px_rgba(18,53,36,0.06),0_20px_48px_rgba(18,53,36,0.16)]">
                    <Image
                      src={f.image}
                      alt={f.imageAlt}
                      width={f.imageWidth}
                      height={f.imageHeight}
                      className="h-auto w-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ----- Gestão do dia a dia (grade secundária) -----
              Adicionada em 20/10/2026 com Colaboradores e EPIs homologados,
              que faltavam, mais Estoque e Usuários — telas de apoio que
              complementam a jornada principal acima sem repetir imagem. */}
          <div className="mt-20 border-t border-border-subtle pt-16 lg:mt-24 lg:pt-20">
            <div className="max-w-xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
                Gestão do dia a dia
              </div>
              <h3 className="mt-3 text-[22px] font-bold leading-tight tracking-tight text-foreground sm:text-[25px]">
                E o cadastro completo por trás de tudo isso.
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">
                Colaboradores, EPIs homologados, estoque e usuários — a base
                de dados que sustenta as entregas, os relatórios e a
                auditoria.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {GESTAO_DIA_A_DIA.map((g) => (
                <div key={g.title} className="flex flex-col">
                  <div className="overflow-hidden rounded-xl shadow-[0_1px_2px_rgba(18,53,36,0.06),0_10px_24px_rgba(18,53,36,0.12)]">
                    <Image
                      src={g.image}
                      alt={g.imageAlt}
                      width={g.imageWidth}
                      height={g.imageHeight}
                      className="h-auto w-full"
                    />
                  </div>
                  <div className="mt-4 text-[14.5px] font-semibold text-foreground">
                    {g.title}
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
                    {g.desc}
                  </p>
                </div>
              ))}
            </div>
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

      {/* ===== Sobre / Conheça o fundador =====
          Reescrita em 19/10/2026 a pedido do Rafael, com a foto e o texto
          que ele mandou prontos ("Quero criar essa tela tbem! Com a minha
          foto e esse texto, capriche.") — texto do fundador reproduzido
          como ele escreveu, só organizado no layout do site. Mantive o
          registro MTE 0066256/SP (não estava no texto que ele colou, mas já
          existia nesta seção antes — removê-lo seria perder um dado de
          credibilidade profissional sem o Rafael ter pedido isso). Note: o
          texto dele diz "Fundador e CEO da MorSafe" aqui, enquanto o rodapé
          mais abaixo ainda diz "Fundador e Diretor" — mantive os dois como
          estavam, sem padronizar um pelo outro, por não ter sido pedido. */}
      <section id="sobre" className="scroll-mt-16 border-b border-border-subtle">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <div className="text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
            Conheça o fundador
          </div>

          <div className="mt-10 grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="relative mx-auto w-full max-w-sm lg:sticky lg:top-24">
              <div
                className="absolute -inset-4 -z-10 rounded-[2rem]"
                style={{
                  background:
                    "radial-gradient(circle at 30% 20%, rgba(52,160,94,0.18), transparent 60%)",
                }}
              />
              <div className="overflow-hidden rounded-2xl border border-border-subtle shadow-[0_1px_2px_rgba(18,53,36,0.06),0_16px_40px_rgba(18,53,36,0.14)]">
                <Image
                  src="/marketing/rafael-morgado.webp"
                  alt="Rafael Morgado, fundador e CEO da MorSafe"
                  width={900}
                  height={1125}
                  className="h-auto w-full"
                />
              </div>
              <div className="mt-5 text-center lg:text-left">
                <div className="text-[17px] font-bold tracking-tight text-foreground">
                  Rafael Morgado
                </div>
                <div className="mt-0.5 text-[13.5px] font-semibold text-brand-700">
                  Fundador e CEO da MorSafe
                </div>
                <div className="mt-0.5 text-[12px] text-text-muted">
                  Técnico em Segurança do Trabalho · MTE 0066256/SP
                </div>
              </div>
            </div>

            <div>
              <blockquote className="border-l-2 border-brand-600 pl-4 text-[17px] italic leading-relaxed text-foreground sm:text-[19px]">
                &ldquo;A tecnologia deve simplificar a rotina das empresas e
                estar ao alcance de todos, independentemente do seu
                tamanho.&rdquo;
              </blockquote>

              <div className="mt-7 space-y-4 text-[14.5px] leading-relaxed text-text-secondary">
                <p className="text-[15.5px] font-semibold text-foreground">
                  Uma solução criada por quem conhece a realidade da
                  Segurança do Trabalho.
                </p>
                <p>
                  A MorSafe nasceu da experiência prática de quem vive a
                  rotina da Segurança do Trabalho há mais de uma década.
                </p>
                <p>
                  Ao longo dessa trajetória, percebi uma necessidade
                  recorrente no mercado: muitas pequenas e médias empresas
                  ainda realizam o controle de Equipamentos de Proteção
                  Individual (EPIs) por meio de planilhas, fichas de papel
                  ou processos descentralizados entre a Segurança do
                  Trabalho, o almoxarifado e o setor de compras.
                </p>
                <p>
                  Ao mesmo tempo, soluções mais amplas de gestão de SST
                  podem ser complexas e representar um investimento elevado
                  para empresas que precisam de algo mais simples,
                  acessível e eficiente.
                </p>
                <p>
                  Foi dessa realidade que surgiu a MorSafe: uma solução
                  idealizada por quem conhece os desafios do dia a dia e
                  acredita que tecnologia, inovação e praticidade não devem
                  ser privilégios de grandes empresas.
                </p>
                <p>
                  Nosso propósito é democratizar o acesso à gestão digital
                  de EPIs, ajudando empresas de diferentes portes a
                  organizar entregas, acompanhar estoques, manter
                  históricos e transformar processos manuais em uma rotina
                  mais simples e confiável.
                </p>
                <p className="text-[15.5px] font-semibold text-foreground">
                  Mais do que desenvolver um sistema, queremos transformar
                  a maneira como as empresas gerenciam seus EPIs. Porque
                  cuidar das pessoas também significa oferecer ferramentas
                  melhores para quem cuida da segurança delas.
                </p>
              </div>

              <p className="mt-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
                MorSafe — Controle de EPI na prática.
              </p>
            </div>
          </div>
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

      {/* Mora — assistente de IA do MorSafe (20/10/2026, a pedido do Rafael).
          Widget flutuante, conversa com /api/mora. Ver
          src/components/mora/mora-widget.tsx. */}
      <MoraWidget />
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

function IconFolderSearch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 7a1.5 1.5 0 0 1 1.5-1.5h4l1.6 2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 18.5H4.5A1.5 1.5 0 0 1 3 17V7Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="13.2" cy="13" r="2.4" stroke="currentColor" strokeWidth={1.6} />
      <path
        d="M15.1 14.9 17 16.8"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
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
