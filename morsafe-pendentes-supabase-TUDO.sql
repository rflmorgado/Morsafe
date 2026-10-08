-- ============================================================
-- MorSafe — TODAS as migrações pendentes da cobrança via Asaas,
-- consolidadas num arquivo só.
--
-- COMO USAR: copie este arquivo inteiro e cole no SQL Editor do Supabase
-- (Project > SQL Editor > New query), clique em "Run". Pode ser rodado
-- mais de uma vez sem erro e em qualquer ordem relativa aos outros
-- arquivos morsafe-add-*.sql — toda instrução aqui usa "IF NOT EXISTS"
-- (tabela, coluna ou índice), então o que já existir é só pulado, nunca
-- recriado nem apagado.
--
-- POR QUE ESTE ARQUIVO EXISTE: o código da aplicação (lib/asaas/client.ts,
-- app/api/webhooks/asaas/route.ts, app/(app)/assinaturas/,
-- app/(app)/setup-empresa/, app/(app)/pagamentos/) já referencia a tabela
-- `assinaturas`, a coluna `pagamentos_empresa.asaas_payment_id` e a tabela
-- `asaas_webhook_events` há várias sessões — mas o arquivo .sql que
-- deveria criá-los (morsafe-add-assinaturas-asaas.sql, citado em
-- comentários espalhados pelo código) nunca foi encontrado no
-- repositório ao revisar tudo em 08/10/2026. Pelas mesmas marcas de
-- "PENDENTE" em morsafe-add-pagamentos-empresa.sql e
-- morsafe-add-limite-colaboradores.sql (chamado de suporte do Supabase
-- aberto desde 28/09/2026), o mais provável é que isto nunca chegou a
-- ser rodado de verdade — ou seja, a cobrança automática via Asaas
-- (assinatura mensal recorrente, taxa de implantação, webhook,
-- régua de inadimplência) pode nunca ter funcionado em produção até
-- este script ser executado. CONFIRME no Table Editor do Supabase se
-- `assinaturas` já existe antes de assumir que a automação já rodou.
-- ============================================================


-- ------------------------------------------------------------
-- 1) pagamentos_empresa — tabela base (idêntica a
--    morsafe-add-pagamentos-empresa.sql, repetida aqui só pra este
--    arquivo poder ser rodado sozinho, do zero, sem depender da ordem).
-- ------------------------------------------------------------
create table if not exists pagamentos_empresa (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresas(id) on delete cascade,
  valor            numeric(10,2) not null,
  data_vencimento  date not null,
  status           text not null default 'pendente' check (status in ('pendente', 'pago')),
  data_pagamento   date,
  observacao       text,
  criado_em        timestamptz not null default now()
);
comment on table pagamentos_empresa is 'Cobranças (recorrentes sincronizadas do Asaas + avulsas, inclusive taxa de implantação) de cada empresa cliente do MorSafe. RLS desabilitado por design: só acessada via service role, nas telas do super_admin.';

create index if not exists idx_pagamentos_empresa_empresa_id on pagamentos_empresa(empresa_id);
create index if not exists idx_pagamentos_empresa_vencimento on pagamentos_empresa(data_vencimento);


-- ------------------------------------------------------------
-- 2) pagamentos_empresa.asaas_payment_id — liga cada cobrança local à
--    cobrança real no Asaas (ver criarPagamento, pagamentos/actions.ts, e
--    criarEmpresa, setup-empresa/actions.ts). Índice ÚNICO parcial (só
--    quando preenchido) garante que o webhook (upsert onConflict:
--    "asaas_payment_id") nunca duplica linha pro mesmo pagamento —
--    sem esse índice o upsert falha ou duplica.
-- ------------------------------------------------------------
alter table pagamentos_empresa
  add column if not exists asaas_payment_id text;
comment on column pagamentos_empresa.asaas_payment_id is 'Id da cobrança no Asaas. NULL em cobrança sem Asaas por trás (controle 100% manual anterior).';

create unique index if not exists idx_pagamentos_empresa_asaas_payment_id
  on pagamentos_empresa(asaas_payment_id)
  where asaas_payment_id is not null;


-- ------------------------------------------------------------
-- 2b) pagamentos_empresa.asaas_invoice_url — link da fatura hospedada
--     pelo Asaas (Pix/boleto/cartão), pra exibir em Cobranças/empresa
--     sem abrir o painel do Asaas (ver morsafe-add-pagamentos-
--     invoice-url.sql, que repete só este pedaço pra quem já rodou o
--     resto deste arquivo antes).
-- ------------------------------------------------------------
alter table pagamentos_empresa
  add column if not exists asaas_invoice_url text;
comment on column pagamentos_empresa.asaas_invoice_url is 'Link da fatura hospedada pelo Asaas (Pix/boleto/cartão). NULL em cobrança sem Asaas por trás, ou ainda não sincronizada.';


-- ------------------------------------------------------------
-- 3) assinaturas — estado ATUAL da assinatura recorrente de cada
--    empresa cliente (uma linha por empresa). Os 5 status (seção 7 do
--    modelo comercial) nunca pulam etapa sozinhos: o webhook só leva de
--    pendente a ativa/inadimplente; suspensa/cancelada só por decisão
--    explícita (régua de inadimplência — cron verificar-inadimplencia —
--    ou cancelamento pedido pelo cliente, ver assinaturas/actions.ts).
-- ------------------------------------------------------------
create table if not exists assinaturas (
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
comment on table assinaturas is 'Estado ATUAL da assinatura mensal recorrente de cada empresa cliente comercial (uma linha por empresa) — espelha o que está no Asaas, sincronizado pelo webhook (ver app/api/webhooks/asaas/route.ts). RLS desabilitado por design, mesmo motivo de pagamentos_empresa: só acessada via service role, nas telas do super_admin.';

create unique index if not exists idx_assinaturas_empresa_id on assinaturas(empresa_id);
create index if not exists idx_assinaturas_status on assinaturas(status);
create unique index if not exists idx_assinaturas_asaas_customer_id
  on assinaturas(asaas_customer_id)
  where asaas_customer_id is not null;
create unique index if not exists idx_assinaturas_asaas_subscription_id
  on assinaturas(asaas_subscription_id)
  where asaas_subscription_id is not null;


-- ------------------------------------------------------------
-- 4) asaas_webhook_events — dedup dos webhooks do Asaas já processados
--    (campo "id" do payload). Sem isso, um reenvio do Asaas (timeout,
--    instabilidade) reprocessaria o mesmo evento duas vezes.
-- ------------------------------------------------------------
create table if not exists asaas_webhook_events (
  evento_id    text primary key,
  evento_tipo  text not null,
  recebido_em  timestamptz not null default now()
);
comment on table asaas_webhook_events is 'Dedup de eventos de webhook do Asaas já processados — a segunda tentativa de INSERT com o mesmo evento_id cai em unique_violation (23505) e a rota responde 200 sem reprocessar nada (ver app/api/webhooks/asaas/route.ts).';


-- ------------------------------------------------------------
-- 5) empresas.limite_colaboradores (idêntico a
--    morsafe-add-limite-colaboradores.sql, repetido aqui pelo mesmo
--    motivo do item 1 — segurança de poder rodar este arquivo sozinho).
-- ------------------------------------------------------------
alter table empresas
  add column if not exists limite_colaboradores integer;
comment on column empresas.limite_colaboradores is 'Limite de colaboradores ativos incluído no plano contratado pela empresa cliente. NULL = sem limite definido ainda.';

-- ============================================================
-- FIM — depois de rodar, confira no Table Editor: `assinaturas` e
-- `asaas_webhook_events` devem aparecer na lista de tabelas, e
-- `pagamentos_empresa` deve ter as colunas asaas_payment_id e
-- asaas_invoice_url.
-- ============================================================
