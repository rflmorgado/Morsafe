import type { Metadata } from "next";
import {
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page-shell";
import {
  PLANO_LABEL,
  PLANO_VALOR_MENSAL,
  PLANO_LIMITE_COLABORADORES,
  PLANOS_ORDENADOS,
  TAXA_IMPLANTACAO,
  formatValorPlano,
} from "@/lib/data/planos";

export const metadata: Metadata = {
  title: "Termos de Uso | MorSafe",
  description: "Condições comerciais e de uso da plataforma MorSafe.",
};

// Dias de tolerância após o vencimento antes da suspensão de acesso —
// MESMO número de GRACE_DIAS em
// src/app/api/cron/verificar-inadimplencia/route.ts. Repetido aqui (não
// importado dali, que é um Route Handler, não um módulo compartilhável
// sem efeito colateral) só como texto — se GRACE_DIAS mudar lá, mudar
// aqui também pra este documento continuar batendo com o comportamento
// real do sistema.
const DIAS_TOLERANCIA_INADIMPLENCIA = 10;

export default function TermosDeUsoPage() {
  return (
    <LegalPageShell
      kicker="Condições comerciais e de uso"
      title="Termos de Uso"
      meta={[
        { label: "Versão", value: "1.0" },
        { label: "Vigência", value: "A partir de 19 de outubro de 2026" },
        { label: "Aplica-se a", value: "Empresas clientes da MorSafe e seus usuários" },
        { label: "Responsável", value: "Rafael Morgado — Fundador e Diretor" },
      ]}
    >
      <p className="text-[14.5px] leading-relaxed text-foreground">
        Estes Termos de Uso (&ldquo;Termos&rdquo;) regem a contratação e a
        utilização da plataforma MorSafe, solução digital para controle de
        entrega de Equipamentos de Proteção Individual (EPI) e gestão de
        conformidade com a Norma Regulamentadora nº 06 (NR-06). Ao contratar
        ou utilizar a MorSafe, a empresa cliente e seus usuários concordam
        com estes Termos.
      </p>

      <LegalSection n="1" title="Quem somos">
        <p>
          A MorSafe é operada atualmente por <strong>Rafael Morgado</strong>,
          na qualidade de Fundador e Diretor responsável pela solução
          (&ldquo;MorSafe&rdquo;, &ldquo;nós&rdquo;). Enquanto o processo de
          formalização da pessoa jurídica da MorSafe está em andamento,
          Rafael Morgado assume pessoalmente, perante as empresas clientes,
          as obrigações e responsabilidades comerciais previstas nestes
          Termos — sem prejuízo da atualização deste documento tão logo o
          CNPJ da MorSafe seja constituído.
        </p>
        <p>
          Canal de contato para dúvidas, suporte ou questões comerciais:{" "}
          <a
            href="mailto:contato.morsafe.br@gmail.com"
            className="font-semibold text-brand-700 hover:underline"
          >
            contato.morsafe.br@gmail.com
          </a>{" "}
          · (11) 92750-0869.
        </p>
      </LegalSection>

      <LegalSection n="2" title="O serviço">
        <p>
          A MorSafe é fornecida no modelo de assinatura mensal
          (&ldquo;Software as a Service&rdquo;), acessada pela internet, e
          permite à empresa cliente: cadastrar colaboradores, setores,
          cargos e EPIs homologados; registrar entregas, trocas, devoluções
          e recusas de EPI com assinatura eletrônica; acompanhar o
          vencimento de Certificados de Aprovação (C.A.); e emitir
          relatórios e fichas de EPI com código de verificação, entre
          outras funcionalidades descritas na plataforma.
        </p>
        <p>
          A plataforma está em desenvolvimento contínuo — novas
          funcionalidades podem ser adicionadas e funcionalidades existentes
          podem ser ajustadas, sem que isso represente redução do conjunto
          essencial de recursos contratado pela empresa cliente no plano
          vigente.
        </p>
      </LegalSection>

      <LegalSection n="3" title="Cadastro, implantação e acesso">
        <p>
          O acesso de uma nova empresa cliente é criado pela própria
          MorSafe, que configura a conta inicial e pode au
