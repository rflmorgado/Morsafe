-- ============================================================
-- MorSafe — Schema do banco de dados (multiempresa)
-- Compatível com Supabase / PostgreSQL 14+
-- Como usar: copie todo este arquivo e cole no SQL Editor do
-- Supabase (Project > SQL Editor > New query) e clique em "Run".
--
-- ARQUITETURA MULTIEMPRESA:
-- Toda tabela relevante carrega uma coluna empresa_id. Isso
-- permite que o MESMO sistema (mesmo banco, mesma aplicação)
-- atenda a ViniPlast hoje e qualquer outra empresa no futuro,
-- com isolamento total de dados entre elas via Row Level
-- Security (RLS) — uma empresa NUNCA consegue ver dados de
-- outra, mesmo com acesso ao mesmo banco.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 0. EMPRESAS (tenants)
-- ============================================================
create table empresas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cnpj        text unique,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
comment on table empresas is 'Cada empresa cliente do MorSafe (ex: ViniPlast). Todo o restante do sistema é isolado por empresa_id.';

-- ============================================================
-- 0.0.1 UNIDADES (filiais dentro de uma mesma empresa)
-- ============================================================
create table unidades (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nome        text not null,
  criado_em   timestamptz not null default now(),
  unique (empresa_id, nome)
);
comment on table unidades is 'Filiais/unidades operacionais dentro da mesma empresa (ex: ViniPlast e Vinitrade sob o mesmo grupo). Diferente de empresa_id, que isola clientes distintos do MorSafe.';

-- ============================================================
-- 0.1 USUÁRIOS (quem acessa o sistema, vinculado ao Supabase Auth)
-- ============================================================
create type papel_usuario as enum ('admin', 'encarregado', 'leitura');

create table usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  empresa_id  uuid not null references empresas(id) on delete restrict,
  nome        text not null,
  papel       papel_usuario not null default 'encarregado',
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
comment on table usuarios is 'Perfil de acesso de cada usuário do MorSafe, vinculado a uma única empresa. id é o mesmo do Supabase Auth (auth.users).';

-- Função auxiliar: retorna a empresa do usuário logado (usada em todas as políticas de RLS abaixo)
create or replace function auth_empresa_id()
returns uuid as $$
  select empresa_id from usuarios where id = auth.uid()
$$ language sql stable;

-- ============================================================
-- 1. SETORES
-- ============================================================
create table setores (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  unidade_id  uuid not null references unidades(id) on delete cascade,
  nome        text not null,
  criado_em   timestamptz not null default now(),
  unique (unidade_id, nome)
);
comment on table setores is 'Setores/ambientes de cada unidade, conforme o respectivo PGR. Um setor de mesmo nome pode existir em unidades diferentes (ex: Portaria na ViniPlast e Portaria na Vinitrade) como registros distintos.';

-- ============================================================
-- 2. CARGOS
-- ============================================================
create table cargos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  setor_id    uuid not null references setores(id) on delete restrict,
  nome        text not null,
  criado_em   timestamptz not null default now(),
  unique (setor_id, nome)
);
comment on table cargos is 'Cargos/funções dentro de cada setor.';

-- ============================================================
-- 3. COLABORADORES
-- ============================================================
create type status_colaborador as enum ('ativo', 'inativo');

create table colaboradores (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  nome          text not null,
  cpf           text,
  telefone      text,
  setor_id      uuid not null references setores(id) on delete restrict,
  cargo_id      uuid not null references cargos(id) on delete restrict,
  status        status_colaborador not null default 'ativo',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, cpf)
);
comment on table colaboradores is 'Colaboradores cadastrados no sistema de EPI de cada empresa.';
create index idx_colaboradores_nome on colaboradores using gin (to_tsvector('portuguese', nome));
create index idx_colaboradores_empresa on colaboradores (empresa_id);

-- ============================================================
-- 4. EPIs HOMOLOGADOS
-- ============================================================
create table epis (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references empresas(id) on delete cascade,
  nome                text not null,
  tipo                text,
  ca                  text,                          -- Certificado de Aprovação (nulo se não exigir CA, ex: Balaclava)
  exige_ca            boolean not null default true,  -- false para itens como Balaclava
  ca_validade         date,
  arquivo_ca_url      text,
  vida_util_dias      integer,
  fornecedor          text,
  custo_medio_atual   numeric(10,2) not null default 0,
  ativo               boolean not null default true,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  constraint chk_ca_coerente check (
    (exige_ca = true) or (exige_ca = false and ca_validade is null)
  )
);
comment on table epis is 'Cadastro mestre de EPIs homologados por empresa, com CA e custo médio ponderado.';
create index idx_epis_nome on epis using gin (to_tsvector('portuguese', nome));
create index idx_epis_empresa on epis (empresa_id);

-- ============================================================
-- 5. VÍNCULO SETOR x EPI
-- ============================================================
create table setor_epi (
  empresa_id  uuid not null references empresas(id) on delete cascade,
  setor_id    uuid not null references setores(id) on delete cascade,
  epi_id      uuid not null references epis(id) on delete cascade,
  obrigatorio boolean not null default true,
  primary key (setor_id, epi_id)
);
comment on table setor_epi is 'Define quais EPIs são obrigatórios em cada setor, espelhando o PGR de cada empresa.';

-- ============================================================
-- 6. ESTOQUE
-- ============================================================
create table estoque (
  epi_id        uuid primary key references epis(id) on delete cascade,
  empresa_id    uuid not null references empresas(id) on delete cascade,
  saldo_atual   integer not null default 0,
  limite_alerta integer not null default 5,
  atualizado_em timestamptz not null default now()
);
comment on table estoque is 'Saldo atual de cada EPI. Atualizado automaticamente por triggers — nunca editar manualmente.';

-- ============================================================
-- 7. ENTRADAS DE ESTOQUE
-- ============================================================
create table entradas_estoque (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  epi_id          uuid not null references epis(id) on delete restrict,
  quantidade      integer not null check (quantidade > 0),
  preco_unitario  numeric(10,2) not null check (preco_unitario >= 0),
  fornecedor      text,
  nota_fiscal     text,
  data_compra     date not null default current_date,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references usuarios(id)
);
comment on table entradas_estoque is 'Cada compra/recebimento de EPI. Preço varia por compra — base do custo médio ponderado.';
create index idx_entradas_epi_data on entradas_estoque (epi_id, data_compra);

-- ============================================================
-- 8. MOTIVOS PADRONIZADOS
-- ============================================================
create type motivo_entrega as enum (
  'primeira_entrega','troca_desgaste','troca_dano','perda','roubo',
  'vencimento_vida_util','vencimento_ca'
);
create type motivo_devolucao as enum (
  'troca','desligamento','mudanca_funcao','extraviado_nao_devolvido'
);
create type destino_devolucao as enum ('descarte', 'reaproveitamento', 'nao_aplicavel');

-- ============================================================
-- 9. ENTREGAS
-- ============================================================
create table entregas (
  id                        uuid primary key default gen_random_uuid(),
  empresa_id                uuid not null references empresas(id) on delete cascade,
  colaborador_id            uuid not null references colaboradores(id) on delete restrict,
  epi_id                    uuid not null references epis(id) on delete restrict,
  data                      date not null default current_date,
  hora                      time not null default current_time,
  motivo                    motivo_entrega not null,
  assinatura_url            text not null,
  custo_unitario_no_momento numeric(10,2) not null,
  criado_em                 timestamptz not null default now(),
  criado_por                uuid references usuarios(id)
);
comment on table entregas is 'Registro de entrega de EPI. custo_unitario_no_momento é um snapshot imutável.';
create index idx_entregas_colaborador on entregas (colaborador_id, data);
create index idx_entregas_empresa on entregas (empresa_id, data);

-- ============================================================
-- 10. DEVOLUÇÕES
-- ============================================================
create table devolucoes (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references empresas(id) on delete cascade,
  colaborador_id        uuid not null references colaboradores(id) on delete restrict,
  epi_id                uuid not null references epis(id) on delete restrict,
  entrega_vinculada_id  uuid references entregas(id) on delete set null,
  data                  date not null default current_date,
  motivo                motivo_devolucao not null,
  destino               destino_devolucao not null default 'nao_aplicavel',
  devolvido_fisicamente boolean not null default true,
  criado_em             timestamptz not null default now(),
  criado_por            uuid references usuarios(id)
);
comment on table devolucoes is 'Registro de devolução. Quando originada por troca, herda a data da entrega vinculada, mesmo se devolvido_fisicamente = false.';
create index idx_devolucoes_colaborador on devolucoes (colaborador_id, data);

-- ============================================================
-- 11. RECUSAS
-- ============================================================
create table recusas (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas(id) on delete cascade,
  colaborador_id uuid not null references colaboradores(id) on delete restrict,
  epi_id         uuid not null references epis(id) on delete restrict,
  data           date not null default current_date,
  hora           time not null default current_time,
  testemunha     text,
  observacoes    text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references usuarios(id)
);
comment on table recusas is 'Registro formal de recusa do colaborador em usar o EPI fornecido.';

-- ============================================================
-- 12. AUDITORIA NR-06
-- ============================================================
create table auditorias_nr06 (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas(id) on delete cascade,
  setor_id       uuid not null references setores(id) on delete restrict,
  data           date not null default current_date,
  responsavel    text not null,
  p1_eficaz                    boolean,
  p2_protecao_coletiva_tentada boolean,
  p3_uso_ininterrupto          boolean,
  p4_ajustado_campo            boolean,
  p5_ca_validado_na_compra     boolean,
  p6_periodicidade_troca       boolean,
  p7_higienizacao              boolean,
  p8_manutencao                boolean,
  observacoes    text,
  criado_em      timestamptz not null default now()
);
comment on table auditorias_nr06 is 'Checklist de auditoria periódica de NR-06 por setor, reaproveitando as 8 perguntas oficiais do PGR.';

-- ============================================================
-- 13. LOG DE AUDITORIA (imutabilidade)
-- ============================================================
create table log_auditoria (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references empresas(id) on delete cascade,
  tabela_referencia text not null,
  registro_id       uuid not null,
  acao              text not null,
  usuario           uuid references usuarios(id),
  detalhes          jsonb,
  criado_em         timestamptz not null default now()
);
comment on table log_auditoria is 'Trilha de auditoria: correções geram novo registro e ficam logadas aqui — nada é editado ou apagado silenciosamente.';

-- ============================================================
-- FUNÇÕES E TRIGGERS
-- ============================================================

create or replace function fn_registrar_entrada_estoque()
returns trigger as $$
declare
  saldo_anterior integer;
  custo_anterior numeric(10,2);
  novo_custo     numeric(10,2);
begin
  select saldo_atual into saldo_anterior from estoque where epi_id = new.epi_id;
  if saldo_anterior is null then
    insert into estoque (epi_id, empresa_id, saldo_atual) values (new.epi_id, new.empresa_id, 0);
    saldo_anterior := 0;
  end if;

  select custo_medio_atual into custo_anterior from epis where id = new.epi_id;

  if (saldo_anterior + new.quantidade) = 0 then
    novo_custo := new.preco_unitario;
  else
    novo_custo := ((saldo_anterior * custo_anterior) + (new.quantidade * new.preco_unitario))
                  / (saldo_anterior + new.quantidade);
  end if;

  update epis set custo_medio_atual = round(novo_custo, 2), atualizado_em = now() where id = new.epi_id;
  update estoque set saldo_atual = saldo_atual + new.quantidade, atualizado_em = now() where epi_id = new.epi_id;

  return new;
end;
$$ language plpgsql;

create trigger trg_entrada_estoque
  after insert on entradas_estoque
  for each row execute function fn_registrar_entrada_estoque();

create or replace function fn_registrar_entrega()
returns trigger as $$
begin
  if new.custo_unitario_no_momento is null then
    select custo_medio_atual into new.custo_unitario_no_momento from epis where id = new.epi_id;
  end if;
  update estoque set saldo_atual = saldo_atual - 1, atualizado_em = now() where epi_id = new.epi_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_entrega_baixa_estoque
  before insert on entregas
  for each row execute function fn_registrar_entrega();

create or replace function fn_registrar_devolucao()
returns trigger as $$
begin
  if new.destino = 'reaproveitamento' then
    update estoque set saldo_atual = saldo_atual + 1, atualizado_em = now() where epi_id = new.epi_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_devolucao_estoque
  after insert on devolucoes
  for each row execute function fn_registrar_devolucao();

-- ============================================================
-- VIEWS de dashboard
-- ============================================================
create view vw_consumo_mensal as
select
  e.empresa_id,
  date_trunc('month', e.data)::date as mes,
  s.nome as setor,
  ep.nome as epi,
  count(*) as qtd_entregue,
  sum(e.custo_unitario_no_momento) as gasto_total
from entregas e
join colaboradores c on c.id = e.colaborador_id
join setores s on s.id = c.setor_id
join epis ep on ep.id = e.epi_id
group by 1, 2, 3, 4
order by 2 desc, gasto_total desc;

create view vw_estoque_baixo as
select es.empresa_id, ep.id as epi_id, ep.nome, es.saldo_atual, es.limite_alerta
from estoque es
join epis ep on ep.id = es.epi_id
where es.saldo_atual <= es.limite_alerta;

create view vw_ca_vencendo as
select empresa_id, id as epi_id, nome, ca, ca_validade
from epis
where exige_ca = true
  and ca_validade is not null
  and ca_validade <= (current_date + interval '30 days');

-- ============================================================
-- ROW LEVEL SECURITY — isolamento total entre empresas
-- ============================================================
alter table setores enable row level security;
alter table unidades enable row level security;
alter table cargos enable row level security;
alter table colaboradores enable row level security;
alter table epis enable row level security;
alter table setor_epi enable row level security;
alter table estoque enable row level security;
alter table entradas_estoque enable row level security;
alter table entregas enable row level security;
alter table devolucoes enable row level security;
alter table recusas enable row level security;
alter table auditorias_nr06 enable row level security;
alter table log_auditoria enable row level security;
alter table usuarios enable row level security;

create policy empresa_isolada on setores using (empresa_id = auth_empresa_id());
create policy empresa_isolada on unidades using (empresa_id = auth_empresa_id());
create policy empresa_isolada on cargos using (empresa_id = auth_empresa_id());
create policy empresa_isolada on colaboradores using (empresa_id = auth_empresa_id());
create policy empresa_isolada on epis using (empresa_id = auth_empresa_id());
create policy empresa_isolada on setor_epi using (empresa_id = auth_empresa_id());
create policy empresa_isolada on estoque using (empresa_id = auth_empresa_id());
create policy empresa_isolada on entradas_estoque using (empresa_id = auth_empresa_id());
create policy empresa_isolada on entregas using (empresa_id = auth_empresa_id());
create policy empresa_isolada on devolucoes using (empresa_id = auth_empresa_id());
create policy empresa_isolada on recusas using (empresa_id = auth_empresa_id());
create policy empresa_isolada on auditorias_nr06 using (empresa_id = auth_empresa_id());
create policy empresa_isolada on log_auditoria using (empresa_id = auth_empresa_id());
create policy propria_empresa on usuarios using (empresa_id = auth_empresa_id());

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
