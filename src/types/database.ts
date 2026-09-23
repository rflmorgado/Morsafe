/**
 * Tipos do banco MorSafe (Supabase / PostgreSQL).
 *
 * Gerados manualmente a partir de `morsafe-schema.sql` (schema real, já
 * aplicado no projeto Supabase "morsafe"). Ao alterar o schema no banco,
 * atualize este arquivo — ou, melhor, regenere com o Supabase CLI:
 *
 *   npx supabase gen types typescript --project-id mfvdovlziaqrdcdmbnmi > src/types/database.ts
 *
 * O formato (Row/Insert/Update/Relationships por tabela, Row/Relationships
 * por view) segue o que @supabase/postgrest-js exige em `GenericSchema`
 * para resolver os tipos de `.select()`, inclusive em joins embutidos
 * (`setores ( nome )`) — sem `Relationships` o parser de tipos não
 * reconhece o schema e todo `.select()` cai em `never`.
 */

export type PapelUsuario = "super_admin" | "admin" | "encarregado" | "leitura";
export type StatusColaborador = "ativo" | "inativo";
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
      empresas: TableDef<
        {
          id: string;
          nome: string;
          cnpj: string | null;
          endereco: string | null;
          ativo: boolean;
          criado_em: string;
        },
        "nome"
      >;

      unidades: TableDef<
        {
          id: string;
          empresa_id: string;
          nome: string;
          criado_em: string;
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
          // Data em que o colaborador realizou a Integração de Segurança —
          // treinamento de admissão que cobre, entre outras coisas, o uso
          // correto de EPI (a NR-06 exige orientação sobre uso, guarda e
          // conservação, não só a entrega). Fica na maioria das empresas
          // vinculado à integração geral, não a cada entrega individual.
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
    };

    Functions: Record<string, never>;
  };
}
