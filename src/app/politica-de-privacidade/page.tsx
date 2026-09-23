import type { Metadata } from "next";
import {
  LegalPageShell,
  LegalSection,
  LegalList,
} from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Política de Privacidade | MorSafe",
  description: "Como a MorSafe trata dados pessoais na plataforma de controle de EPI.",
};

export default function PoliticaDePrivacidadePage() {
  return (
    <LegalPageShell
      kicker="Proteção de dados pessoais"
      title="Política de Privacidade"
      meta={[
        { label: "Versão", value: "1.0" },
        { label: "Vigência", value: "A partir de 23 de setembro de 2026" },
        { label: "Aplica-se a", value: "Empresas clientes da MorSafe e seus colaboradores" },
        { label: "Responsável", value: "Rafael Morgado — Fundador e Diretor" },
      ]}
    >
      <p className="text-[14.5px] leading-relaxed text-brand-900">
        Este documento descreve como a MorSafe trata os dados pessoais dos
        colaboradores e usuários das empresas clientes que utilizam a
        plataforma para controle de entrega de Equipamentos de Proteção
        Individual (EPI) e gestão de conformidade com a Norma Regulamentadora
        nº 06 (NR-06), em observância à Lei Geral de Proteção de Dados
        Pessoais (Lei nº 13.709/2018 — &ldquo;LGPD&rdquo;).
      </p>

      <LegalSection n="1" title="Quem somos">
        <p>
          A MorSafe é uma solução digital para controle de entrega de EPI,
          gestão de colaboradores, cadastro de equipamentos homologados e
          trilha de auditoria, operada atualmente por{" "}
          <strong>Rafael Morgado</strong>, na qualidade de Fundador e Diretor
          responsável pela solução (&ldquo;MorSafe&rdquo;, &ldquo;nós&rdquo;).
          Enquanto o processo de formalização da pessoa jurídica da MorSafe
          está em andamento, Rafael Morgado assume pessoalmente, perante os
          titulares de dados e as empresas clientes, as obrigações e
          responsabilidades previstas nesta Política e na legislação de
          proteção de dados aplicável — sem prejuízo da atualização deste
          documento tão logo o CNPJ da MorSafe seja constituído.
        </p>
        <p>
          Canal de contato para dúvidas, solicitações ou exercício de direitos
          relacionados a esta Política:{" "}
          <a
            href="mailto:contato.morsafe.br@gmail.com"
            className="font-semibold text-brand-700 hover:underline"
          >
            contato.morsafe.br@gmail.com
          </a>{" "}
          · (11) 94776-6392.
        </p>
      </LegalSection>

      <LegalSection n="2" title="A quem esta Política se aplica">
        <p>
          Esta Política se aplica a todos os colaboradores e usuários das
          empresas que contratam a MorSafe (&ldquo;empresas clientes&rdquo;)
          e cujos dados sejam inseridos, direta ou indiretamente, na
          plataforma. Cada empresa cliente é a <strong>Controladora</strong>{" "}
          dos dados de seus próprios colaboradores; a MorSafe atua como{" "}
          <strong>Operadora</strong>, tratando esses dados exclusivamente
          conforme as instruções da empresa cliente e para viabilizar as
          funcionalidades contratadas, nos termos definidos no Contrato de
          Tratamento de Dados Pessoais firmado entre as partes.
        </p>
      </LegalSection>

      <LegalSection n="3" title="Quais dados coletamos">
        <p className="font-semibold text-foreground">
          Dados de colaboradores cadastrados pela empresa cliente:
        </p>
        <LegalList
          items={[
            "nome completo, CPF, cargo/função e setor;",
            "data de admissão e, quando aplicável, de desligamento;",
            "EPIs entregues, respectivos Certificados de Aprovação (C.A.) e datas de entrega, troca ou devolução;",
            "registro de recebimento (confirmação/assinatura eletrônica do colaborador ou de quem realizou a entrega).",
          ]}
        />
        <p className="font-semibold text-foreground">
          Dados de usuários com acesso ao sistema:
        </p>
        <LegalList
          items={[
            "nome, e-mail corporativo e papel de acesso (leitura, encarregado, administrador);",
            "registros de atividade dentro da plataforma (histórico de ações, login/logout, data e hora de acesso), para fins de segurança e rastreabilidade.",
          ]}
        />
        <p>
          A MorSafe <strong>não coleta dados sensíveis</strong> (como saúde,
          biometria ou dados genéticos) — apenas os dados estritamente
          necessários à gestão de EPI e à conformidade com a NR-06.
        </p>
      </LegalSection>

      <LegalSection n="4" title="Base legal do tratamento">
        <LegalList
          items={[
            <>
              <strong>Cumprimento de obrigação legal ou regulatória</strong>{" "}
              (art. 7º, II, da LGPD): a NR-06 exige que o empregador mantenha
              registro/ficha de controle de entrega de EPI a cada colaborador;
            </>,
            <>
              <strong>Legítimo interesse</strong> da empresa cliente na gestão
              de segurança do trabalho e na organização de seus processos
              internos;
            </>,
            <>
              <strong>Execução de contrato</strong>, para viabilizar o
              funcionamento da plataforma contratada pela empresa cliente;
            </>,
            <>
              <strong>Consentimento</strong>, quando aplicável, para
              finalidades específicas e não abrangidas pelas bases acima.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection n="5" title="Para que usamos os dados">
        <LegalList
          items={[
            "gerar fichas de EPI e controlar a validade dos Certificados de Aprovação;",
            "produzir relatórios de conformidade com a NR-06;",
            "gerenciar o cadastro de colaboradores, EPIs, setores e funções;",
            "autenticar usuários e controlar permissões de acesso por papel;",
            "manter trilha de auditoria das ações realizadas na plataforma, para garantia e rastreabilidade.",
          ]}
        />
      </LegalSection>

      <LegalSection n="6" title="Com quem compartilhamos">
        <p>
          Cada empresa cliente acessa exclusivamente os dados da própria
          empresa: o isolamento entre empresas é garantido tecnicamente por
          políticas de segurança em nível de linha (<em>Row Level
          Security</em>) no banco de dados, de forma que nenhuma empresa
          cliente tem acesso a dados de outra.
        </p>
        <p>
          Para operar a plataforma, a MorSafe utiliza os seguintes
          prestadores de infraestrutura tecnológica (subprocessadores), sob
          contrato e padrões internacionais de segurança da informação:
        </p>
        <LegalList
          items={[
            <><strong>Supabase</strong> — banco de dados, autenticação e armazenamento;</>,
            <><strong>Vercel</strong> — hospedagem da aplicação.</>,
          ]}
        />
        <p>
          Esses prestadores podem processar ou armazenar dados em servidores
          localizados fora do Brasil, sempre sob salvaguardas contratuais e
          técnicas adequadas (criptografia em trânsito e controles de
          acesso). A MorSafe <strong>não vende, não aluga e não
          compartilha</strong> dados pessoais com terceiros para fins de
          marketing.
        </p>
      </LegalSection>

      <LegalSection n="7" title="Por quanto tempo guardamos os dados">
        <p>
          Os dados são mantidos enquanto durar o vínculo contratual entre a
          empresa cliente e a MorSafe, e pelo prazo adicional necessário ao
          cumprimento de obrigações legais — a NR-06 pressupõe a manutenção
          do controle de entrega de EPI durante todo o vínculo empregatício
          do colaborador, podendo a legislação trabalhista correlata exigir
          prazos adicionais de guarda. Encerrado o contrato com a empresa
          cliente, os dados ficam disponíveis por um prazo razoável para fins
          de exportação/transição, definido em conjunto com a empresa
          cliente, sendo em seguida excluídos ou anonimizados, salvo
          obrigação legal de retenção por prazo diverso.
        </p>
      </LegalSection>

      <LegalSection n="8" title="Segurança da informação">
        <p>
          A MorSafe adota medidas técnicas e administrativas para proteger os
          dados pessoais tratados — o detalhamento completo dos controles
          está na nossa{" "}
          <a
            href="/seguranca-da-informacao"
            className="font-semibold text-brand-700 hover:underline"
          >
            Política de Segurança da Informação
          </a>
          . Em resumo: isolamento lógico dos dados por empresa cliente,
          controle de acesso por papel de usuário, tráfego criptografado
          (HTTPS/TLS), trilha de auditoria das ações realizadas na
          plataforma, e exclusão lógica prévia à exclusão definitiva de
          cadastros.
        </p>
      </LegalSection>

      <LegalSection n="9" title="Seus direitos como titular de dados">
        <p>
          Nos termos do art. 18 da LGPD, o titular dos dados pode solicitar,
          a qualquer momento e mediante requisição:
        </p>
        <LegalList
          items={[
            "confirmação da existência de tratamento;",
            "acesso aos dados;",
            "correção de dados incompletos, inexatos ou desatualizados;",
            "anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a LGPD;",
            "portabilidade dos dados a outro fornecedor de serviço;",
            "eliminação dos dados tratados com base no consentimento;",
            "informação sobre entidades públicas e privadas com as quais os dados foram compartilhados;",
            "informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;",
            "revogação do consentimento, quando esta for a base legal aplicável.",
          ]}
        />
        <p>
          Colaboradores de empresas clientes podem exercer esses direitos
          diretamente com a própria empresa (Controladora dos seus dados) ou
          pelo canal de contato indicado no item 1 desta Política, que
          encaminhará a solicitação à empresa responsável quando necessário.
        </p>
      </LegalSection>

      <LegalSection n="10" title="Alterações desta Política">
        <p>
          Esta Política pode ser atualizada para refletir melhorias na
          plataforma ou mudanças na legislação aplicável. A versão vigente e
          a data da última atualização estão sempre indicadas no início deste
          documento; alterações relevantes serão comunicadas às empresas
          clientes.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
