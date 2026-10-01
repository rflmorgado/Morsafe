-- ============================================================
-- MorSafe — Nova tabela: pagamentos_empresa
-- Controle de mensalidade/pagamento de cada empresa cliente,
-- visto só pelo super_admin (telas /pagamentos e /empresas/[id]).
--
-- COMO USAR: copie este arquivo inteiro e cole no SQL Editor do
-- Supabase (Project > SQL Editor > New query), clique em "Run".
--
-- PENDENTE: só pode ser aplicado quando o acesso ao painel do
-- Supabase for recuperado (chamado de suporte aberto desde
-- 28/09/2026, ainda sem resposta). Até lá, o código da aplicação
-- (actions.ts, lib/data/pagamentos.ts etc.) já está pronto e
-- referenciando esta tabela, mas não vai funcionar em produção
-- até este script ser rodado — as telas novas vão ficar vazias
-- ou dar erro de "relation does not exist" ao tentar ler/gravar.
-- ============================================================

create table pagamentos_empresa (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresas(id) on delete cascade,
  valor            numeric(10,2) not null,
  data_vencimento  date not null,
  -- Só dois estados gravados: "pendente" (ainda não recebido) e "pago".
  -- "Atrasado" e "a vencer" NÃO são gravados aqui — são calculados na
  -- aplicação a partir de data_vencimento + status (ver
  -- src/lib/data/pagamentos.ts), pra nunca ficar com um status desatualizado
  -- só porque ninguém voltou aqui pra marcar como atrasado na data certa.
  status           text not null default 'pendente' check (status in ('pendente', 'pago')),
  -- Preenchida só quando status passa a 'pago' (ver
  -- marcarPagamentoComoPago em src/app/(app)/pagamentos/actions.ts).
  data_pagamento   date,
  observacao       text,
  criado_em        timestamptz not null default now()
);
comment on table pagamentos_empresa is 'Controle manual de mensalidade de cada empresa cliente do MorSafe — não é um gateway de pagamento, é um registro que o super_admin cria e marca como pago. RLS desabilitado por design (mesma decisão já tomada para a tabela empresas): só acessada via service role, nas telas do super_admin, que nunca pertence a uma empresa_id pra uma policy baseada em auth_empresa_id() bater com nada.';

create index idx_pagamentos_empresa_empresa_id on pagamentos_empresa(empresa_id);
create index idx_pagamentos_empresa_vencimento on pagamentos_empresa(data_vencimento);

-- ============================================================
-- FIM
-- ============================================================
