/**
 * Tipos do banco MorSafe (Supabase / PostgreSQL).
 *
 * Reconstruído em 04/11/2026 direto do schema real em produção (projeto
 * Supabase "morsafe", kqjvmgexmvvkyoxoagsb) — a versão anterior deste
 * arquivo estava desatualizada (datava de 23/09/2026) e não tinha várias
 * tabelas/colunas criadas desde então (cobrança via Asaas: `assinaturas`,
 * `asaas_webhook_events`, `pagamentos_empresa`; estação de assinatura:
 * `estacoes_assinatura`, `solicitacoes_assinatura`; `verificacoes_documento`;
 * `empresas_excluidas`; `ajustes_estoque`; e colunas novas em tabelas já
 * existentes), o que quebrou o build (ver histórico de deploys no Vercel
 * em 04/11/2026). Ao alterar o schema no banco, atualize este arquivo —
 * ou, melhor, regenere com o Supabase CLI:
 *
 *   npx supabase gen types typescript --project-id kqjvmgexmvvkyoxoagsb > src/types/database.ts
 *
 * O formato (Row/Insert/Update/Relationships por tabela, Row/Relationships
 * por view) segue o que @supabase/postgrest-js exige em `GenericSchema`
 * para resolver os tipos de `.select()`, inclusive em joins embutidos
 * (`setores ( nome )`) — sem `Relationships` o parser de tipos não
 * reconhece o schema e todo `.select()` cai em `never`.
 */

export type PapelUsuario = "super_admin" | "admin" | "encarregado" | "leitura";
export type StatusColaborador = "ativo" | "inativo";
// Ciclo de vida contratual da empresa. "encerrada" é o que dispara a
// contagem dos 5 anos de retenção pós-rescisão prometidos no contrato e no
// DPA — ver Cláusula de retenção do contrato de prestação de serviços.
export type StatusEmpresa = "ativa" | "suspensa_inadimplencia" | "encerrada";
export type MotivoEntrega =
  | "primeira_entrega"
  | "troca_desgaste"
  | "troca_dano"
  | "perda"
  | "roubo"
  | "vencimento_vida_util"
  | "vencimento_ca";
export type MotivoDevolucao =
  | "troca"
  | "desligamento"
  | "mudanca_funcao"
  | "extraviado_nao_devolvido";
export type DestinoDevolucao = "descarte" | "reaproveitamento" | "nao_aplicavel";
export type StatusSolicitacaoAssinatura =
  | "aguardando"
  | "assinado"
  | "cancelado"
  | "expirado";
export type TipoSolicitacaoAssinatura = "entrega" | "devolucao";
// `assinaturas.status` e `assinaturas.plano` são colunas `text` com CHECK
// no banco (não enum de verdade), então o Supabase CLI não geraria estes
// tipos sozinho — mantidos aqui à mão, igual o resto deste arquivo, porque
// assinaturas/actions.ts já importa `PlanoAssinatura` daqui.
export type StatusAssinatura =
  | "ativa"
  | "pendente"
  | "inadimplente"
  | "suspensa"
  | "cancelada";
export type PlanoAssinatura =
  | "start"
  | "essencial"
  | "profissional"
  | "empresa"
  | "industrial"
  | "enterprise";
// `pagamentos_empresa.status` é outra coluna `text` com CHECK (não enum)
// — mesmo caso de StatusAssinatura/PlanoAssinatura acima. Já tem um
// consumidor (src/lib/data/pagamentos.ts) que importa este nome exato.
export type StatusPagamentoEmpresa = "pendente" | "pago";

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type TableDef<
  Row,
  InsertRequired extends keyof Row,
  Rel extends readonly Relationship[] = [],
> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, InsertRequired>;
  Update: Partial<Row>;
  Relationships: Rel;
};

type ViewDef<Row, Rel extends readonly Relationship[] = []> = {
  Row: Row;
  Relationships: Rel;
};

export interface Database {
  public: {
    Tables: {
      ajustes_estoque: TableDef<
        {
          id: string;
          empresa_id: string;
          epi_id: string;
          saldo_anterior: number;
          saldo_novo: number;
          motivo: string;
          criado_em: string;
          criado_por: string | null;
        },
        "empresa_id" | "epi_id" | "saldo_anterior" | "saldo_novo" | "motivo",
        [
          {
            foreignKeyName: "ajustes_estoque_criado_por_fkey";
            columns: ["criado_por"];
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ajustes_estoque_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ajustes_estoque_epi_id_fkey";
            columns: ["epi_id"];
            referencedRelation: "epis";
            referencedColumns: ["id"];
          },
        ]
      >;

      asaas_webhook_events: TableDef<
        {
          evento_id: string;
          evento_tipo: string;
          recebido_em: string;
        },
        "evento_id" | "evento_tipo"
      >;

      assinaturas: TableDef<
        {
          id: string;
          empresa_id: string;
          plano: PlanoAssinatura;
          valor_mensal: number;
          status: StatusAssinatura;
          asaas_customer_id: string | null;
          asaas_subscription_id: string | null;
          proximo_vencimento: string | null;
          suspensa_em: string | null;
          cancelada_em: string | null;
          criado_em: string;
          atualizado_em: string;
        },
        "empresa_id" | "plano" | "valor_mensal",
        [
          {
            foreignKeyName: "assinaturas_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ]
      >;

      empresas: TableDef<
        {
          id: string;
          nome: string;
          cnpj: string | null;
          criado_em: string;
          limite_colaboradores: number | null;
          endereco: string | null;
          logo_url: string | null;
          email_cobranca: string | null;
          // Gerada no banco a partir de `status` (sempre = status ===
          // "ativa"). Mantida só para não quebrar código antigo que ainda
          // lê `ativo`; código novo deve usar `status`.
          ativo: boolean;
          status: StatusEmpresa;
          suspensa_em: string | null;
          encerrada_em: string | null;
        },
        "nome"
      >;

      empresas_excluidas: TableDef<
        {
          id: string;
          empresa_id: string;
          empresa_nome: string;
          empresa_cnpj: string | null;
          empresa_criada_em: string | null;
          excluida_em: string;
          excluida_por_nome: string;
          excluida_por_email: string;
          resumo: Record<string, unknown>;
        },
        "empresa_id" | "empresa_nome" | "excluida_por_nome" | "excluida_por_email"
      >;

      unidades: TableDef<
        {
          id: string;
          empresa_id: string;
          nome: string;
          criado_em: string;
          logo_url: string | null;
        },
        "empresa_id" | "nome",
        [
          {
            foreignKeyName: "unidades_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ]
      >;

      usuarios: TableDef<
        {
          id: string; // = auth.users.id
          // null apenas para o(s) usuário(s) super_admin, que não pertencem
          // a nenhuma empresa cliente (só eles podem cadastrar empresas
          // novas em /setup-empresa).
          empresa_id: string | null;
          nome: string;
          papel: PapelUsuario;
          ativo: boolean;
          // Última vez que o usuário fez qualquer request autenticado
          // (atualizado no middleware, com throttle de 1 min) — base da
          // bolinha de presença (verde/laranja/vermelho) em /usuarios.
          ultima_atividade: string | null;
          criado_em: string;
        },
        "id" | "nome",
        [
          {
            foreignKeyName: "usuarios_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ]
      >;

      setores: TableDef<
        {
          id: string;
          empresa_id: string;
          unidade_id: string;
          nome: string;
          criado_em: string;
        },
        "empresa_id" | "unidade_id" | "nome",
        [
          {
            foreignKeyName: "setores_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "setores_unidade_id_fkey";
            columns: ["unidade_id"];
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ]
      >;

      cargos: TableDef<
        {
          id: string;
          empresa_id: string;
          setor_id: string;
          nome: string;
          criado_em: string;
        },
        "empresa_id" | "setor_id" | "nome",
        [
          {
            foreignKeyName: "cargos_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cargos_setor_id_fkey";
            columns: ["setor_id"];
            referencedRelation: "setores";
            referencedColumns: ["id"];
          },
        ]
      >;

      colaboradores: TableDef<
        {
          id: string;
          empresa_id: string;
          nome: string;
          cpf: string | null;
          telefone: string | null;
          setor_id: string;
          cargo_id: string;
          status: StatusColaborador;
          // Data da Integração de Segurança (treinamento de admissão) ou,
          // para empresas que reciclam a NR-06 anualmente, da última
          // reciclagem/treinamento — é o mesmo campo nos dois casos, só
          // atualizado a cada reciclagem por quem faz isso todo ano. Cobre a
          // exigência da NR-06 de orientação sobre uso, guarda e conservação
          // de EPI, que vai além da simples entrega do equipamento.
          data_integracao_seguranca: string | null;
          criado_em: string;
          atualizado_em: string;
        },
        "empresa_id" | "nome" | "setor_id" | "cargo_id",
        [
          {
            foreignKeyName: "colaboradores_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "colaboradores_setor_id_fkey";
            columns: ["setor_id"];
            referencedRelation: "setores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "colaboradores_cargo_id_fkey";
            columns: ["cargo_id"];
            referencedRelation: "cargos";
            referencedColumns: ["id"];
          },
        ]
      >;

      epis: TableDef<
        {
          id: string;
          empresa_id: string;
          nome: string;
          tipo: string | null;
          ca: string | null;
          exige_ca: boolean;
          ca_validade: string | null;
          arquivo_ca_url: string | null;
          vida_util_dias: number | null;
          fornecedor: string | null;
          custo_medio_atual: number;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
        },
        "empresa_id" | "nome",
        [
          {
            foreignKeyName: "epis_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ]
      >;

      setor_epi: TableDef<
        {
          empresa_id: string;
          setor_id: string;
          epi_id: string;
          obrigatorio: boolean;
        },
        "empresa_id" | "setor_id" | "epi_id",
        [
          {
            foreignKeyName: "setor_epi_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "setor_epi_setor_id_fkey";
            columns: ["setor_id"];
            referencedRelation: "setores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "setor_epi_epi_id_fkey";
            columns: ["epi_id"];
            referencedRelation: "epis";
            referencedColumns: ["id"];
          },
        ]
      >;

      estoque: TableDef<
        {
          epi_id: string;
          empresa_id: string;
          saldo_atual: number;
          limite_alerta: number;
          atualizado_em: string;
        },
        "epi_id" | "empresa_id",
        [
          {
            foreignKeyName: "estoque_epi_id_fkey";
            columns: ["epi_id"];
            isOneToOne: true;
            referencedRelation: "epis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estoque_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ]
      >;

      entradas_estoque: TableDef<
        {
          id: string;
          empresa_id: string;
          epi_id: string;
          quantidade: number;
          preco_unitario: number;
          fornecedor: string | null;
          nota_fiscal: string | null;
          data_compra: string;
          criado_em: string;
          criado_por: string | null;
        },
        "empresa_id" | "epi_id" | "quantidade" | "preco_unitario",
        [
          {
            foreignKeyName: "entradas_estoque_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entradas_estoque_epi_id_fkey";
            columns: ["epi_id"];
            referencedRelation: "epis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entradas_estoque_criado_por_fkey";
            columns: ["criado_por"];
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ]
      >;

      entregas: TableDef<
        {
          id: string;
          empresa_id: string;
          colaborador_id: string;
          epi_id: string;
          data: string;
          hora: string;
          motivo: MotivoEntrega;
          // Quantidade de unidades entregues nesse registro — nem toda
          // entrega é de uma unidade só (ex.: um par de luvas, um pacote de
          // protetores auriculares). Tem default 1 no banco, mas a aplicação
          // sempre envia o valor explícito escolhido no formulário.
          quantidade: number;
          assinatura_url: string;
          custo_unitario_no_momento: number;
          criado_em: string;
          criado_por: string | null;
          // Agrupa várias entregas feitas na mesma leva (ex.: estação de
          // assinatura coletando várias entregas numa visita só). NULL numa
          // entrega avulsa registrada fora de um grupo.
          grupo_entrega_id: string | null;
        },
        | "empresa_id"
        | "colaborador_id"
        | "epi_id"
        | "motivo"
        | "assinatura_url"
        | "custo_unitario_no_momento",
        [
          {
            foreignKeyName: "entregas_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entregas_colaborador_id_fkey";
            columns: ["colaborador_id"];
            referencedRelation: "colaboradores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entregas_epi_id_fkey";
            columns: ["epi_id"];
            referencedRelation: "epis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entregas_criado_por_fkey";
            columns: ["criado_por"];
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ]
      >;

      devolucoes: TableDef<
        {
          id: string;
          empresa_id: string;
          colaborador_id: string;
          epi_id: string;
          entrega_vinculada_id: string | null;
          data: string;
          motivo: MotivoDevolucao;
          destino: DestinoDevolucao;
          devolvido_fisicamente: boolean;
          criado_em: string;
          criado_por: string | null;
          assinatura_url: string | null;
        },
        "empresa_id" | "colaborador_id" | "epi_id" | "motivo",
        [
          {
            foreignKeyName: "devolucoes_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "devolucoes_colaborador_id_fkey";
            columns: ["colaborador_id"];
            referencedRelation: "colaboradores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "devolucoes_epi_id_fkey";
            columns: ["epi_id"];
            referencedRelation: "epis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "devolucoes_entrega_vinculada_id_fkey";
            columns: ["entrega_vinculada_id"];
            referencedRelation: "entregas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "devolucoes_criado_por_fkey";
            columns: ["criado_por"];
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ]
      >;

      recusas: TableDef<
        {
          id: string;
          empresa_id: string;
          colaborador_id: string;
          epi_id: string;
          data: string;
          hora: string;
          testemunha: string | null;
          observacoes: string | null;
          criado_em: string;
          criado_por: string | null;
        },
        "empresa_id" | "colaborador_id" | "epi_id",
        [
          {
            foreignKeyName: "recusas_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recusas_colaborador_id_fkey";
            columns: ["colaborador_id"];
            referencedRelation: "colaboradores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recusas_epi_id_fkey";
            columns: ["epi_id"];
            referencedRelation: "epis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recusas_criado_por_fkey";
            columns: ["criado_por"];
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ]
      >;

      auditorias_nr06: TableDef<
        {
          id: string;
          empresa_id: string;
          setor_id: string;
          data: string;
          responsavel: string;
          p1_eficaz: boolean | null;
          p2_protecao_coletiva_tentada: boolean | null;
          p3_uso_ininterrupto: boolean | null;
          p4_ajustado_campo: boolean | null;
          p5_ca_validado_na_compra: boolean | null;
          p6_periodicidade_troca: boolean | null;
          p7_higienizacao: boolean | null;
          p8_manutencao: boolean | null;
          observacoes: string | null;
          criado_em: string;
        },
        "empresa_id" | "setor_id" | "responsavel",
        [
          {
            foreignKeyName: "auditorias_nr06_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "auditorias_nr06_setor_id_fkey";
            columns: ["setor_id"];
            referencedRelation: "setores";
            referencedColumns: ["id"];
          },
        ]
      >;

      log_auditoria: TableDef<
        {
          id: string;
          empresa_id: string;
          tabela_referencia: string;
          registro_id: string;
          acao: string;
          usuario: string | null;
          detalhes: Record<string, unknown> | null;
          criado_em: string;
        },
        "empresa_id" | "tabela_referencia" | "registro_id" | "acao",
        [
          {
            foreignKeyName: "log_auditoria_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "log_auditoria_usuario_fkey";
            columns: ["usuario"];
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ]
      >;

      pagamentos_empresa: TableDef<
        {
          id: string;
          empresa_id: string;
          valor: number;
          data_vencimento: string;
          status: StatusPagamentoEmpresa;
          data_pagamento: string | null;
          observacao: string | null;
          asaas_payment_id: string | null;
          asaas_invoice_url: string | null;
          criado_em: string;
        },
        "empresa_id" | "valor" | "data_vencimento",
        [
          {
            foreignKeyName: "pagamentos_empresa_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ]
      >;

      estacoes_assinatura: TableDef<
        {
          id: string;
          empresa_id: string;
          nome: string;
          token: string | null;
          codigo_pareamento: string | null;
          codigo_expira_em: string | null;
          ativo: boolean;
          criado_em: string;
          pareado_em: string | null;
          ultimo_ping: string | null;
        },
        "empresa_id" | "nome",
        [
          {
            foreignKeyName: "estacoes_assinatura_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ]
      >;

      solicitacoes_assinatura: TableDef<
        {
          id: string;
          empresa_id: string;
          estacao_id: string;
          status: StatusSolicitacaoAssinatura;
          tipo: TipoSolicitacaoAssinatura;
          colaborador_nome: string;
          epi_nome: string;
          assinatura_url: string | null;
          criado_por: string | null;
          criado_em: string;
          respondido_em: string | null;
        },
        "empresa_id" | "estacao_id" | "colaborador_nome" | "epi_nome",
        [
          {
            foreignKeyName: "solicitacoes_assinatura_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitacoes_assinatura_estacao_id_fkey";
            columns: ["estacao_id"];
            referencedRelation: "estacoes_assinatura";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitacoes_assinatura_criado_por_fkey";
            columns: ["criado_por"];
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ]
      >;

      verificacoes_documento: TableDef<
        {
          id: string;
          codigo: string;
          empresa_id: string;
          empresa_nome: string;
          colaborador_id: string;
          colaborador_nome: string;
          tipo_documento: string;
          quantidade_eventos: number;
          hash_conteudo: string;
          gerado_por: string | null;
          gerado_em: string;
        },
        | "codigo"
        | "empresa_id"
        | "empresa_nome"
        | "colaborador_id"
        | "colaborador_nome"
        | "tipo_documento"
        | "quantidade_eventos"
        | "hash_conteudo",
        [
          {
            foreignKeyName: "verificacoes_documento_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verificacoes_documento_colaborador_id_fkey";
            columns: ["colaborador_id"];
            referencedRelation: "colaboradores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verificacoes_documento_gerado_por_fkey";
            columns: ["gerado_por"];
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ]
      >;

    };

    Views: {
      vw_consumo_mensal: ViewDef<{
        empresa_id: string;
        mes: string;
        setor: string;
        epi: string;
        qtd_entregue: number;
        gasto_total: number;
      }>;
      vw_estoque_baixo: ViewDef<{
        empresa_id: string;
        epi_id: string;
        nome: string;
        saldo_atual: number;
        limite_alerta: number;
      }>;
      vw_ca_vencendo: ViewDef<{
        empresa_id: string;
        epi_id: string;
        nome: string;
        ca: string | null;
        ca_validade: string | null;
      }>;
      // Nova (ver comentário da tabela no Supabase): EPIs com 2+ ajustes
      // manuais de estoque nos últimos 90 dias — sinal de possível processo
      // quebrado, usado pelo card "Alertas" do Dashboard.
      vw_ajustes_recorrentes: ViewDef<{
        empresa_id: string;
        epi_id: string;
        nome: string;
        ca: string | null;
        tipo: string | null;
        quantidade_ajustes: number;
        ultimo_ajuste_em: string;
      }>;
    };

    Functions: Record<string, never>;
  };
}
