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
  criado_em   timestamptz not null default now(),
  -- Drift descoberto em 13/10/2026 ao migrar os dados da ViniPlast: colunas
  -- já usadas pelo app (ver database.ts) e com dado real de produção, mas
  -- nunca tinham sido adicionadas aqui.
  endereco    text,
  logo_url    text
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
-- 'super_admin' é o papel da equipe do MorSafe (nunca de uma empresa
-- cliente) — não pertence a nenhuma empresa (ver empresa_id abaixo,
-- nullable só por causa dele) e só ele acessa /empresas, /pagamentos e
-- /setup-empresa (cadastrar empresa nova). Confirmado como drift em
-- 14/10/2026: existia na produção (código TS já assumia isso, ver
-- PapelUsuario em src/types/database.ts) mas nunca tinha sido migrado
-- aqui — só reproduzido manualmente no banco antigo, fora de qualquer
-- arquivo rastreado.
create type papel_usuario as enum ('admin', 'encarregado', 'leitura', 'super_admin');

create table usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  -- null apenas para usuário(s) super_admin, que não pertencem a nenhuma
  -- empresa cliente (só eles podem cadastrar empresas novas em
  -- /setup-empresa) — ver comentário do enum acima, mesmo drift.
  empresa_id  uuid references empresas(id) on delete restrict,
  nome        text not null,
  papel       papel_usuario not null default 'encarregado',
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
comment on table usuarios is 'Perfil de acesso de cada usuário do MorSafe, vinculado a uma única empresa (exceto super_admin, sem empresa). id é o mesmo do Supabase Auth (auth.users).';

-- Função auxiliar: retorna a empresa do usuário logado (usada em todas as
-- políticas de RLS abaixo, inclusive a própria política de `usuarios`).
-- security definer + search_path fixo são OBRIGATÓRIOS aqui, não só boa
-- prática: sem isso, a consulta interna a `usuarios` fica sujeita à RLS
-- de `usuarios`, cuja política (propria_empresa, abaixo) chama esta
-- mesma função — recursão infinita ("stack depth limit exceeded").
-- Rodando como security definer, a consulta interna ignora RLS (não abre
-- brecha: ela só LÊ empresa_id da própria linha do usuário logado, nunca
-- grava nem expõe dado de outra linha). Descoberto como drift em
-- 14/10/2026 ao recriar o banco do zero — a função de produção tinha
-- isso, mas nunca tinha sido salva num arquivo rastreado.
create or replace function auth_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from usuarios where id = auth.uid()
$$;

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
  -- Drift descoberto em 13/10/2026 ao migrar os dados da ViniPlast: coluna
  -- já usada pelo app (ver database.ts) e com dado real de produção, mas
  -- nunca tinha sido adicionada aqui.
  data_integracao_seguranca date,
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
-- 14. VERIFICAÇÕES DE DOCUMENTO (QR code)
-- ============================================================
-- Ausente deste arquivo até 14/10/2026 — tabela criada direto no SQL
-- Editor em algum momento, sem nunca ser documentada aqui (mesmo tipo
-- de drift de empresas.endereco/logo_url acima, só que numa tabela
-- inteira). Reconstruída a partir de src/types/database.ts e
-- confirmada coluna a coluna contra a produção. RLS desabilitado por
-- design, mesmo padrão de empresas: a única forma de achar uma linha
-- é sabendo o código (aleatório, não sequencial) — ver
-- lib/data/verificacao-documento.ts.
create table verificacoes_documento (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,
  empresa_id         uuid not null references empresas(id) on delete cascade,
  empresa_nome       text not null,
  colaborador_id     uuid not null references colaboradores(id) on delete cascade,
  colaborador_nome   text not null,
  tipo_documento     text not null,
  quantidade_eventos integer not null,
  hash_conteudo      text not null,
  gerado_por         uuid references usuarios(id),
  gerado_em          timestamptz not null default now()
);
comment on table verificacoes_documento is 'Snapshot assinado (hash) de uma ficha/documento gerado para verificação pública via QR code. RLS desabilitado por design — só acessível sabendo o código aleatório, nunca por listagem.';

-- ============================================================
-- 15. ESTAÇÕES E SOLICITAÇÕES DE ASSINATURA (tablet/celular pareado)
-- ============================================================
-- Ausentes deste arquivo até 14/10/2026 — mesmo drift de
-- verificacoes_documento acima. Reconstruídas a partir de
-- src/types/database.ts e confirmadas coluna a coluna contra a
-- produção.
create table estacoes_assinatura (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references empresas(id) on delete cascade,
  nome               text not null,
  token              text,
  codigo_pareamento  text,
  codigo_expira_em   timestamptz,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now(),
  pareado_em         timestamptz,
  ultimo_ping        timestamptz
);
comment on table estacoes_assinatura is 'Tablet/celular pareado numa empresa para coletar assinatura em tela. O pareamento e a coleta de assinatura (src/app/estacao/actions.ts) rodam sem usuário logado, só com o token — por isso usam o cliente com service role e ignoram RLS nesse caminho. Mas a tela de administração da empresa (src/app/(app)/estacoes/actions.ts) usa o cliente normal, sujeito a RLS — por isso a policy empresa_isolada abaixo é necessária (achado CRITICAL do Security Advisor em 14/10/2026: faltava RLS aqui).';

create type status_solicitacao_assinatura as enum ('aguardando', 'assinado', 'cancelado', 'expirado');
create type tipo_solicitacao_assinatura as enum ('entrega', 'devolucao');

create table solicitacoes_assinatura (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references empresas(id) on delete cascade,
  estacao_id         uuid not null references estacoes_assinatura(id) on delete cascade,
  status             status_solicitacao_assinatura not null default 'aguardando',
  tipo               tipo_solicitacao_assinatura not null default 'entrega',
  colaborador_nome   text not null,
  epi_nome           text not null,
  assinatura_url     text,
  criado_por         uuid references usuarios(id),
  criado_em          timestamptz not null default now(),
  respondido_em      timestamptz
);
comment on table solicitacoes_assinatura is 'Pedido de assinatura enviado a uma estação pareada — colaborador_nome/epi_nome são snapshot (não FK) porque a estação só tem o token, sem acesso ao resto do banco. Mesmo motivo de estacoes_assinatura acima: policy empresa_isolada necessária pela tela de administração, mesmo a estação em si acessando via service role.';
create index idx_solicitacoes_assinatura_estacao on solicitacoes_assinatura (estacao_id, status);

-- ============================================================
-- 16. PAGAMENTOS DA EMPRESA (cobrança via Asaas)
-- ============================================================
-- Ausente deste arquivo até 14/10/2026 — mesmo drift das tabelas
-- acima.
create table pagamentos_empresa (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresas(id) on delete cascade,
  valor            numeric(10,2) not null,
  data_vencimento  date not null,
  status           text not null default 'pendente' check (status in ('pendente', 'pago')),
  data_pagamento   date,
  observacao       text,
  asaas_payment_id text,
  asaas_invoice_url text,
  criado_em        timestamptz not null default now()
);
comment on table pagamentos_empresa is 'Cobranças (recorrentes sincronizadas do Asaas + avulsas, inclusive taxa de implantação) de cada empresa cliente do MorSafe. Acessada só via service role (telas do super_admin) — policy empresa_isolada abaixo é defesa em profundidade, não o caminho real de acesso hoje.';
create index idx_pagamentos_empresa_empresa_id on pagamentos_empresa(empresa_id);
create index idx_pagamentos_empresa_vencimento on pagamentos_empresa(data_vencimento);
comment on column pagamentos_empresa.asaas_payment_id is 'Id da cobrança no Asaas. NULL em cobrança sem Asaas por trás (controle 100% manual anterior).';
-- Índice único SIMPLES (sem WHERE) de propósito — não é parcial. Um índice
-- único comum do Postgres já trata todo NULL como distinto dos demais
-- (não compara NULL = NULL), então várias cobranças sem Asaas por trás
-- continuam permitidas sem precisar de predicado. A versão parcial
-- (WHERE asaas_payment_id is not null) quebrava o .upsert(...,
-- {onConflict: "asaas_payment_id"}) do webhook (src/app/api/webhooks/
-- asaas/route.ts) com "there is no unique or exclusion constraint
-- matching the ON CONFLICT specification" — Postgres só casa um ON
-- CONFLICT com um índice parcial se o mesmo WHERE for repetido na
-- cláusula ON CONFLICT, e a API do Supabase não permite isso. Corrigido
-- em produção em 15/10/2026 recriando o índice sem o WHERE.
create unique index idx_pagamentos_empresa_asaas_payment_id
  on pagamentos_empresa(asaas_payment_id);
comment on column pagamentos_empresa.asaas_invoice_url is 'Link da fatura hospedada pelo Asaas (Pix/boleto/cartão). NULL em cobrança sem Asaas por trás, ou ainda não sincronizada.';

-- ============================================================
-- 17. ASSINATURAS (estado do plano comercial)
-- ============================================================
create table assinaturas (
  id                     uuid primary key default gen_random_uuid(),
  empresa_id             uuid not null references empresas(id) on delete cascade,
  plano                  text not null check (plano in ('start', 'essencial', 'profissional', 'empresa', 'industrial', 'enterprise')),
  valor_mensal           numeric(10,2) not null,
  status                 text not null default 'pendente' check (status in ('ativa', 'pendente', 'inadimplente', 'suspensa', 'cancelada')),
  asaas_customer_id      text,
  asaas_subscription_id  text,
  proximo_vencimento     date,
  suspensa_em            timestamptz,
  cancelada_em           timestamptz,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);
comment on table assinaturas is 'Estado ATUAL da assinatura mensal recorrente de cada empresa cliente comercial (uma linha por empresa) — espelha o que está no Asaas, sincronizado pelo webhook (ver app/api/webhooks/asaas/route.ts). Mesmo motivo de pagamentos_empresa acima: só acessada via service role, policy empresa_isolada é defesa em profundidade.';
create unique index idx_assinaturas_empresa_id on assinaturas(empresa_id);
create index idx_assinaturas_status on assinaturas(status);
create unique index idx_assinaturas_asaas_customer_id
  on assinaturas(asaas_customer_id)
  where asaas_customer_id is not null;
create unique index idx_assinaturas_asaas_subscription_id
  on assinaturas(asaas_subscription_id)
  where asaas_subscription_id is not null;

-- ============================================================
-- 18. EVENTOS DE WEBHOOK ASAAS (dedup)
-- ============================================================
create table asaas_webhook_events (
  evento_id    text primary key,
  evento_tipo  text not null,
  recebido_em  timestamptz not null default now()
);
comment on table asaas_webhook_events is 'Dedup de eventos de webhook do Asaas já processados — a segunda tentativa de INSERT com o mesmo evento_id cai em unique_violation (23505) e a rota responde 200 sem reprocessar nada (ver app/api/webhooks/asaas/route.ts). RLS ligado sem nenhuma policy (ver seção RLS abaixo) — só o backend, via service role, grava ou lê; qualquer outro acesso deve ficar totalmente bloqueado.';

alter table empresas
  add column limite_colaboradores integer;
comment on column empresas.limite_colaboradores is 'Limite de colaboradores ativos incluído no plano contratado pela empresa cliente. NULL = sem limite definido ainda.';

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
$$ language plpgsql set search_path = public;

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
$$ language plpgsql set search_path = public;

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
$$ language plpgsql set search_path = public;

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

-- Achado "Security Definer View" do Security Advisor em 14/10/2026: uma
-- view sem security_invoker roda com o privilégio de quem CRIOU a view,
-- não de quem está consultando — na prática ignorando silenciosamente o
-- RLS das tabelas por trás. src/lib/data/dashboard.ts já filtrava por
-- empresa_id no código, mas sem isso aqui esse filtro era só defesa de
-- aplicação, nunca garantido pelo banco — uma falha no filtro vazaria
-- dado operacional de uma empresa cliente pra outra (ou pro super_admin).
alter view vw_consumo_mensal set (security_invoker = on);
alter view vw_estoque_baixo set (security_invoker = on);
alter view vw_ca_vencendo set (security_invoker = on);

-- ============================================================
-- ROW LEVEL SECURITY — isolamento total entre empresas
-- (empresas e verificacoes_documento ficam DE FORA de propósito — RLS
-- desabilitado por design, motivo documentado em cada comment on table
-- acima. asaas_webhook_events fica com RLS ligado e SEM nenhuma policy
-- de propósito — só o backend, via service role, deve conseguir
-- acessá-la.)
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
-- As 5 tabelas abaixo ficaram de fora desta seção até 14/10/2026 —
-- achado CRITICAL do Security Advisor ("RLS Disabled in Public"),
-- corrigido na produção e documentado aqui pra fechar o drift.
alter table estacoes_assinatura enable row level security;
alter table solicitacoes_assinatura enable row level security;
alter table pagamentos_empresa enable row level security;
alter table assinaturas enable row level security;
alter table asaas_webhook_events enable row level security;

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
-- id = auth.uid() é essencial, não redundante: sem ele, um super_admin
-- (empresa_id null) nunca bateria com a própria linha via
-- empresa_id = auth_empresa_id(), já que null = null nunca é verdadeiro
-- em SQL — era exatamente isso que travava o login dele (drift
-- descoberto em 14/10/2026, corrigido junto com auth_empresa_id() acima).
create policy propria_empresa on usuarios using (
  id = auth.uid() or empresa_id = auth_empresa_id()
);

create policy empresa_isolada on estacoes_assinatura using (empresa_id = auth_empresa_id());
create policy empresa_isolada on solicitacoes_assinatura using (empresa_id = auth_empresa_id());
create policy empresa_isolada on pagamentos_empresa using (empresa_id = auth_empresa_id());
create policy empresa_isolada on assinaturas using (empresa_id = auth_empresa_id());
-- asaas_webhook_events não recebe nenhuma policy de propósito — RLS
-- ligado e sem policy bloqueia TODO acesso fora do service role, que é
-- exatamente o único caminho de acesso real (ver app/api/webhooks/
-- asaas/route.ts).

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
