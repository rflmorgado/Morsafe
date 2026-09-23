import type { Metadata } from "next";
import {
  LegalPageShell,
  LegalSection,
  LegalList,
} from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Segurança da Informação | MorSafe",
  description: "Controles técnicos e organizacionais da plataforma MorSafe.",
};

export default function SegurancaDaInformacaoPage() {
  return (
    <LegalPageShell
      kicker="Segurança e conformidade"
      title="Política de Segurança da Informação"
      meta={[
        { label: "Versão", value: "1.0" },
        { label: "Vigência", value: "A partir de 23 de setembro de 2026" },
        { label: "Aplica-se a", value: "Infraestrutura, processos e dados da plataforma MorSafe" },
        { label: "Responsável", value: "Rafael Morgado — Fundador e Diretor" },
      ]}
    >
      <p className="text-[14.5px] leading-relaxed text-foreground">
        Este documento formaliza os controles técnicos e organizacionais
        adotados pela MorSafe para proteger os dados tratados na plataforma,
        em conformidade com o art. 46 da Lei Geral de Proteção de Dados
        (LGPD) e com as obrigações de segurança assumidas no Contrato de
        Tratamento de Dados Pessoais firmado com cada empresa cliente.
      </p>

      <LegalSection n="1" title="Objetivo e abrangência">
        <p>
          Estabelecer os princípios, controles e responsabilidades que regem
          a segurança da informação na plataforma MorSafe, aplicáveis a todo
          ambiente, infraestrutura e processo envolvido na operação do
          sistema — do cadastro de colaboradores ao armazenamento de
          históricos de auditoria.
        </p>
      </LegalSection>

      <LegalSection n="2" title="Papéis e responsabilidades">
        <p>
          <strong>Rafael Morgado</strong>, Fundador e Diretor da MorSafe, é o
          responsável atual pela segurança da informação, incluindo a
          definição de controles técnicos, a avaliação de fornecedores de
          infraestrutura e a condução de eventuais respostas a incidentes. À
          medida que a equipe da MorSafe cresça, essas responsabilidades
          serão formalmente distribuídas e esta Política, atualizada.
        </p>
      </LegalSection>

      <LegalSection n="3" title="Controle de acesso e autenticação">
        <LegalList
          items={[
            "acesso à plataforma exige autenticação individual; não existem contas compartilhadas ou genéricas;",
            <>
              cada usuário pertence a uma única empresa, e cada empresa
              enxerga exclusivamente seus próprios dados — o isolamento entre
              empresas é garantido no próprio banco de dados, por políticas
              de segurança em nível de linha (<em>Row Level Security</em>), e
              não depende apenas de regras da aplicação;
            </>,
            "controle de acesso hierárquico por papel de usuário: leitura (consulta), encarregado (operação do dia a dia), administrador (gestão completa da empresa) e super administrador (gestão da MorSafe);",
            "princípio do menor privilégio: todo novo usuário recebe por padrão o papel de menor acesso, e elevações de papel só podem ser feitas por um administrador da própria empresa — ação que também fica registrada na trilha de auditoria.",
          ]}
        />
      </LegalSection>

      <LegalSection n="4" title="Proteção de dados em trânsito e em repouso">
        <LegalList
          items={[
            "todo o tráfego entre o usuário e a plataforma é criptografado (HTTPS/TLS);",
            "os dados são armazenados em infraestrutura de banco de dados gerenciada (Supabase/PostgreSQL), com criptografia em repouso provida pelo próprio provedor de infraestrutura;",
            "a MorSafe não coleta dados sensíveis (saúde, biometria, dados genéticos) — apenas os dados estritamente necessários ao controle de EPI e à conformidade com a NR-06, reduzindo a exposição em caso de incidente.",
          ]}
        />
      </LegalSection>

      <LegalSection n="5" title="Trilha de auditoria e rastreabilidade">
        <p>
          Toda ação relevante realizada na plataforma — cadastro, edição,
          desligamento, desativação, reativação, exclusão definitiva,
          alteração de papel de acesso, importação e exportação de dados,
          download de fichas, login e logout — gera um registro imutável de
          histórico, com identificação de quem realizou a ação, o que foi
          feito e quando. Esse histórico está disponível para consulta pelos
          administradores de cada empresa, garantindo rastreabilidade
          completa para fins de segurança e de conformidade.
        </p>
      </LegalSection>

      <LegalSection n="6" title="Integridade e prevenção de perda de dados">
        <p>
          Cadastros de colaboradores, EPIs e usuários seguem um padrão de
          exclusão em duas etapas: primeiro a desativação/desligamento
          (exclusão lógica), e só então — e apenas se não houver nenhum
          histórico de ações vinculado ao registro — a exclusão definitiva.
          Essa trava impede a perda acidental de dados necessários à trilha
          de auditoria e à conformidade com a NR-06.
        </p>
      </LegalSection>

      <LegalSection n="7" title="Gestão de fornecedores (subprocessadores)">
        <p>
          A MorSafe utiliza os seguintes fornecedores de infraestrutura
          tecnológica para operar a plataforma:
        </p>
        <LegalList
          items={[
            <><strong>Supabase</strong> — banco de dados, autenticação e armazenamento;</>,
            <><strong>Vercel</strong> — hospedagem da aplicação.</>,
          ]}
        />
        <p>
          Ambos os fornecedores mantêm padrões próprios de segurança da
          informação reconhecidos no mercado. A inclusão de novos
          subprocessadores será avaliada quanto à compatibilidade com a LGPD
          e comunicada às empresas clientes quando representar mudança
          relevante no tratamento de dados.
        </p>
      </LegalSection>

      <LegalSection n="8" title="Resposta a incidentes de segurança">
        <p>
          Considera-se incidente de segurança qualquer evento que comprometa
          a confidencialidade, integridade ou disponibilidade dos dados
          tratados na plataforma — acesso não autorizado, vazamento de dados
          ou indisponibilidade que afete a integridade das informações.
        </p>
        <p>Diante de um incidente, a MorSafe segue o seguinte fluxo:</p>
        <LegalList
          items={[
            <><strong>detecção e contenção</strong> — identificação do incidente e adoção imediata de medidas para conter seu impacto;</>,
            <><strong>avaliação de impacto</strong> — levantamento dos dados e das empresas/titulares potencialmente afetados;</>,
            <><strong>notificação</strong> — comunicação às empresas clientes afetadas em até <strong>48 (quarenta e oito) horas</strong> a partir da ciência do incidente, informando natureza, dados afetados, medidas adotadas e recomendações;</>,
            "apoio à comunicação aos titulares, quando exigido pela legislação aplicável, em conjunto com a empresa cliente responsável;",
            "registro e aprendizado — documentação do incidente e das medidas adotadas para reduzir o risco de recorrência.",
          ]}
        />
        <p>
          Incidentes ou suspeitas de incidente podem ser reportados a
          qualquer momento pelo canal{" "}
          <a
            href="mailto:contato.morsafe.br@gmail.com"
            className="font-semibold text-brand-700 hover:underline"
          >
            contato.morsafe.br@gmail.com
          </a>{" "}
          · (11) 94776-6392.
        </p>
      </LegalSection>

      <LegalSection n="9" title="Continuidade e cópias de segurança">
        <p>
          Os dados são mantidos em infraestrutura gerenciada, com rotinas de
          cópia de segurança (<em>backup</em>) providas pelo provedor de
          banco de dados contratado, e hospedagem com redundância provida
          pelo provedor de aplicação. À medida que a base de empresas
          clientes cresça, a MorSafe formalizará metas específicas de tempo
          de recuperação, revisadas periodicamente junto aos fornecedores de
          infraestrutura.
        </p>
      </LegalSection>

      <LegalSection n="10" title="Revisão de contas e acessos">
        <p>
          Cabe ao administrador de cada empresa cliente manter o cadastro de
          usuários atualizado, desativando prontamente o acesso de
          colaboradores que deixem a empresa ou mudem de função, e concedendo
          o papel de administrador apenas a quem realmente precise dele. A
          MorSafe recomenda essa revisão como parte da rotina periódica de
          segurança de cada empresa cliente.
        </p>
      </LegalSection>

      <LegalSection n="11" title="Conscientização e boas práticas">
        <p>
          A MorSafe recomenda às empresas clientes: uso de senhas fortes e
          individuais por usuário; restrição do papel de administrador ao
          número mínimo de pessoas necessário; e comunicação imediata à
          MorSafe, pelo canal indicado no item 8, de qualquer atividade
          suspeita identificada na plataforma.
        </p>
      </LegalSection>

      <LegalSection n="12" title="Revisão e atualização desta Política">
        <p>
          Esta Política é revisada ao menos uma vez por ano, ou sempre que
          houver mudança relevante na infraestrutura, nos processos ou na
          legislação aplicável. A versão vigente e a data da última
          atualização estão sempre indicadas no início deste documento.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
