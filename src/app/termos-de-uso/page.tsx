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
          · (11) 94776-6392.
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
          MorSafe, que configura a conta inicial e pode auxiliar na
          importação dos dados iniciais (colaboradores, EPIs e estoque)
          durante a implantação. A empresa cliente é responsável por indicar
          um administrador responsável, que passa a gerenciar os demais
          usuários, papéis de acesso e dados cadastrados dentro da própria
          conta.
        </p>
        <p>
          A empresa cliente é responsável pela veracidade, exatidão e
          atualização dos dados que cadastra ou que seus usuários cadastram
          na plataforma, inclusive dados de colaboradores, EPIs, C.A. e
          registros de entrega — a MorSafe não audita nem valida o conteúdo
          desses dados antes de armazená-los. Cada usuário é responsável por
          manter suas credenciais de acesso em sigilo e por toda atividade
          realizada sob seu login.
        </p>
      </LegalSection>

      <LegalSection n="4" title="Planos e preços">
        <p>
          A MorSafe é oferecida nos seguintes planos mensais, cada um com um
          limite sugerido de colaboradores ativos:
        </p>
        <div className="overflow-x-auto rounded-lg border border-border-subtle">
          <table className="w-full min-w-[420px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-muted text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">
                <th className="px-3.5 py-2.5">Plano</th>
                <th className="px-3.5 py-2.5">Mensalidade</th>
                <th className="px-3.5 py-2.5">Colaboradores ativos</th>
              </tr>
            </thead>
            <tbody>
              {PLANOS_ORDENADOS.filter((p) => p !== "enterprise").map(
                (plano) => (
                  <tr key={plano} className="border-b border-border-subtle last:border-0">
                    <td className="px-3.5 py-2.5 font-semibold text-foreground">
                      {PLANO_LABEL[plano]}
                    </td>
                    <td className="px-3.5 py-2.5 tabular-nums text-text-secondary">
                      {formatValorPlano(PLANO_VALOR_MENSAL[plano])}/mês
                    </td>
                    <td className="px-3.5 py-2.5 tabular-nums text-text-secondary">
                      até {PLANO_LIMITE_COLABORADORES[plano]}
                    </td>
                  </tr>
                ),
              )}
              <tr>
                <td className="px-3.5 py-2.5 font-semibold text-foreground">
                  {PLANO_LABEL.enterprise}
                </td>
                <td className="px-3.5 py-2.5 text-text-secondary" colSpan={2}>
                  Sob consulta, conforme negociação específica com a empresa
                  cliente.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Além da mensalidade, é cobrada uma{" "}
          <strong>taxa única de implantação de {formatValorPlano(TAXA_IMPLANTACAO)}</strong>,
          referente à configuração inicial da conta, no momento da
          contratação — não recorrente e não vinculada a nenhum plano
          específico.
        </p>
        <p>
          Os valores informados nesta página são os praticados na data de
          vigência indicada no topo deste documento e podem ser reajustados
          para novas contratações; o valor da mensalidade de uma assinatura
          já ativa só muda mediante mudança de plano solicitada pela própria
          empresa cliente ou comunicação prévia da MorSafe em caso de
          reajuste.
        </p>
      </LegalSection>

      <LegalSection n="5" title="Cobrança e formas de pagamento">
        <p>
          A cobrança é processada por meio de uma plataforma de pagamentos
          terceirizada, que gera a fatura mensal recorrente e disponibiliza
          Pix, boleto bancário ou cartão de crédito como formas de
          pagamento, à escolha da empresa cliente a cada cobrança. A MorSafe
          não armazena dados de cartão de crédito — esse processamento é
          feito inteiramente pela plataforma de pagamentos.
        </p>
        <p>
          A confirmação de cada pagamento é recebida e refletida
          automaticamente no status da assinatura, exibido no painel da
          empresa cliente.
        </p>
      </LegalSection>

      <LegalSection n="6" title="Atraso e inadimplência">
        <p>
          Uma cobrança não paga até a data de vencimento marca a assinatura
          como inadimplente. A empresa cliente tem um prazo de tolerância de{" "}
          <strong>{DIAS_TOLERANCIA_INADIMPLENCIA} dias corridos</strong>{" "}
          após o vencimento para regularizar o pagamento sem interrupção do
          serviço. Persistindo a inadimplência após esse prazo, o acesso
          operacional da empresa cliente à plataforma é suspenso, sem
          exclusão de nenhum dado já cadastrado — o acesso é restabelecido
          assim que o pagamento é regularizado.
        </p>
        <p>
          A suspensão por inadimplência não exonera a empresa cliente do
          pagamento dos valores em aberto.
        </p>
      </LegalSection>

      <LegalSection n="7" title="Cancelamento">
        <p>
          A empresa cliente pode solicitar o cancelamento da assinatura a
          qualquer momento pelo canal de contato indicado no item 1. O
          cancelamento interrompe a geração de novas cobranças a partir da
          solicitação; cobranças já geradas e ainda não pagas antes do
          cancelamento continuam devidas.
        </p>
        <p>
          Após o cancelamento, os dados da empresa cliente ficam disponíveis
          por um prazo razoável para fins de exportação, conforme descrito
          na nossa{" "}
          <a
            href="/politica-de-privacidade"
            className="font-semibold text-brand-700 hover:underline"
          >
            Política de Privacidade
          </a>
          , sendo em seguida excluídos ou anonimizados, salvo obrigação
          legal de retenção por prazo diverso.
        </p>
      </LegalSection>

      <LegalSection n="8" title="Disponibilidade e suporte">
        <p>
          A MorSafe envida seus melhores esforços para manter a plataforma
          disponível de forma contínua, mas, por se tratar de um produto em
          estágio inicial, <strong>não oferece, neste momento, um nível de
          serviço (SLA) formal com garantia contratual de disponibilidade
          mínima</strong>. Interrupções podem ocorrer para manutenção,
          correções ou melhorias, preferencialmente fora do horário
          comercial e com aviso prévio quando previsíveis.
        </p>
        <p>
          O suporte à empresa cliente é prestado pelo canal de contato
          indicado no item 1, em horário comercial.
        </p>
      </LegalSection>

      <LegalSection n="9" title="Propriedade intelectual">
        <p>
          A plataforma MorSafe, seu código-fonte, design, marca e demais
          elementos de propriedade intelectual pertencem a Rafael Morgado
          (ou à pessoa jurídica da MorSafe, quando constituída). A
          contratação do serviço concede à empresa cliente uma licença de
          uso não exclusiva e intransferível da plataforma, pelo período da
          assinatura ativa — nunca a cessão de direitos sobre o software em
          si. Os dados inseridos pela empresa cliente (colaboradores, EPIs,
          registros de entrega etc.) permanecem de propriedade da própria
          empresa cliente em todo momento.
        </p>
      </LegalSection>

      <LegalSection n="10" title="Limitação de responsabilidade">
        <p>
          A MorSafe é uma ferramenta de apoio ao controle e à gestão de EPI;
          a responsabilidade legal pelo cumprimento da NR-06 e das demais
          obrigações trabalhistas e de segurança do trabalho perante
          colaboradores e órgãos fiscalizadores permanece sempre da empresa
          cliente, na qualidade de empregadora. A MorSafe responde pela
          correta disponibilização e funcionamento da plataforma, mas não
          pela exatidão dos dados inseridos pela empresa cliente, nem por
          decisões tomadas com base nesses dados.
        </p>
        <p>
          Dentro dos limites permitidos pela legislação aplicável, a
          responsabilidade da MorSafe por eventuais danos decorrentes do uso
          da plataforma fica limitada ao valor total pago pela empresa
          cliente nos 12 (doze) meses anteriores ao evento que deu origem ao
          dano.
        </p>
      </LegalSection>

      <LegalSection n="11" title="Proteção de dados pessoais">
        <p>
          O tratamento de dados pessoais de colaboradores e usuários das
          empresas clientes segue a nossa{" "}
          <a
            href="/politica-de-privacidade"
            className="font-semibold text-brand-700 hover:underline"
          >
            Política de Privacidade
          </a>{" "}
          e as medidas descritas na{" "}
          <a
            href="/seguranca-da-informacao"
            className="font-semibold text-brand-700 hover:underline"
          >
            Política de Segurança da Informação
          </a>
          , que fazem parte integrante destes Termos.
        </p>
      </LegalSection>

      <LegalSection n="12" title="Alterações destes Termos">
        <p>
          Estes Termos podem ser atualizados para refletir melhorias na
          plataforma, mudanças no modelo comercial ou na legislação
          aplicável. A versão vigente e a data da última atualização estão
          sempre indicadas no início deste documento; alterações relevantes
          serão comunicadas às empresas clientes com antecedência razoável.
        </p>
      </LegalSection>

      <LegalSection n="13" title="Lei aplicável e foro">
        <p>
          Estes Termos são regidos pela legislação brasileira. Fica eleito o
          foro da comarca de domicílio da MorSafe para dirimir quaisquer
          controvérsias decorrentes destes Termos, com renúncia a qualquer
          outro, por mais privilegiado que seja, salvo disposição legal em
          contrário.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
