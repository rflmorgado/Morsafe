-- ============================================================
-- MorSafe — Nova tabela: pagamentos_empresa
-- Controle de mensalidade/pagamento de cada empresa cliente,
-- visto só pelo super_admin (telas /pagamentos e /empresas/[id]).
--
-- JÁ APLICADO em produção, na migração pro Supabase novo (16/10/2026, ver
-- morsafe-bootstrap-projeto-novo.sql, que inclui esta mesma tabela — lá
-- com RLS habilitado e policy `empresa_isolada`, correção de segurança
-- feita em 14/10/2026, diferente do "RLS desabilitado por design" ainda
-- descrito abaixo neste arquivo histórico). Este arquivo fica como
-- registro do incremento original; usa "if not exists" pra poder rodar
-- de novo sem erro num banco onde a tabela já exista.
--
-- COMO USAR: copie este arquivo inteiro e cole no SQL Editor do
-- Supabase (Project > SQL Editor > New query), clique em "Run".
-- ============================================================

create table if not exists pagamentos_empresa (
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
comment on table pagamentos_empresa is 'Controle manual de mensalidade de cada empresa cliente do MorSafe — não é um gateway de pagamento, é um registro que o super_admin cria e marca como pago. Só acessada via service role, nas telas do super_admin. RLS habilitado com policy empresa_isolada (correção de segurança de 14/10/2026, ver morsafe-bootstrap-projeto-novo.sql) — defesa em profundidade, já que o acesso real de hoje é todo via service role, que ignora RLS de qualquer forma.';

create index if not exists idx_pagamentos_empresa_empresa_id on pagamentos_empresa(empresa_id);
create index if not exists idx_pagamentos_empresa_vencimento on pagamentos_empresa(data_vencimento);

-- ============================================================
-- FIM
-- ============================================================
