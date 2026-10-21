-- ============================================================
-- MorSafe — Nova tabela: ajustes_estoque
--
-- Pedido do Rafael, 21/10/2026: a empresa conta o estoque físico de EPI no
-- fim de cada mês, e hoje não existe nenhuma forma de corrigir
-- `estoque.saldo_atual` quando o que foi contado não bate com o que
-- entrada/entrega/devolução calcularam sozinhas (ex.: alguém entregou um
-- EPI e esqueceu de registrar no sistema — o saldo do app fica "a mais"
-- que o saldo físico real).
--
-- `estoque.saldo_atual` sempre foi "atualizado automaticamente por
-- triggers — nunca editar manualmente" (comentário original da tabela, ver
-- morsafe-schema.sql linha 199), e isso continua valendo: esta migração
-- NÃO abre uma exceção pra escrever direto nessa coluna a partir do app.
-- Em vez disso, segue o mesmo padrão já usado para entrada de compra
-- (`entradas_estoque` + trigger `fn_registrar_entrada_estoque`): uma
-- tabela de registro histórico, imutável, de cada ajuste — saldo anterior,
-- saldo novo, motivo, quem fez e quando —, e um trigger próprio
-- (`fn_registrar_ajuste_estoque`) é quem de fato grava o novo saldo em
-- `estoque`. Resultado: dá pra corrigir o saldo sem nunca perder o rastro
-- de que uma correção aconteceu, de quanto pra quanto, e por quê — ponto
-- que o próprio Rafael levantou (não dá pra confiar 100% sem esse
-- registro).
--
-- Usada por dois fluxos na tela /estoque (ver src/app/(app)/estoque/):
--   1) "Registrar contagem de estoque" — contagem em lote (fechamento de
--      mês): lista todos os EPIs ativos, Rafael digita o que contou de
--      cada um, só os que realmente mudaram viram uma linha aqui.
--   2) O lápis ao lado do saldo de cada EPI — correção pontual de um item
--      só, a qualquer momento.
-- As duas chamam a mesma Server Action (`ajustarEstoque` /
-- `registrarContagemEstoque`, em src/app/(app)/estoque/actions.ts), que só
-- faz o INSERT aqui — exatamente como registrarEntradaEstoque faz em
-- `entradas_estoque`.
--
-- Mesmo nível de permissão de registrar entrada de estoque ("encarregado"+,
-- decidido com o Rafael em 21/10/2026): é o mesmo perfil que já faz a
-- contagem física no chão de fábrica.
--
-- COMO USAR: copie este arquivo inteiro e cole no SQL Editor do Supabase
-- (Project > SQL Editor > New query), clique em "Run". Idempotente (usa
-- "if not exists") — pode rodar mais de uma vez sem erro.
-- ============================================================

create table if not exists ajustes_estoque (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  epi_id          uuid not null references epis(id) on delete restrict,
  saldo_anterior  integer not null,
  saldo_novo      integer not null check (saldo_novo >= 0),
  motivo          text not null,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references usuarios(id)
);
comment on table ajustes_estoque is 'Correção manual do saldo de um EPI, a partir de contagem física — cada linha é UM ajuste (saldo anterior, saldo novo, motivo, quem fez, quando), nunca apagada nem editada depois de gravada. saldo_atual em `estoque` é recalculado pelo trigger trg_ajuste_estoque a partir daqui — o app nunca escreve direto naquela coluna a partir deste fluxo, igual já acontece com entradas_estoque.';
create index if not exists idx_ajustes_estoque_epi_data on ajustes_estoque (epi_id, criado_em);

alter table ajustes_estoque enable row level security;
create policy empresa_isolada on ajustes_estoque using (empresa_id = auth_empresa_id());

-- Regra 8 do CLAUDE.md (aviso da Supabase recebido hoje, 21/10/2026): toda
-- tabela nova no schema public precisa de grant explícito, senão a Data
-- API (supabase-js) nega com "permission denied" antes mesmo de chegar na
-- RLS acima. Sem grant pra "anon" de propósito — esta tabela só é lida/
-- escrita por usuário autenticado da empresa (nenhuma tela pública usa
-- ajuste de estoque).
grant select, insert, update, delete on public.ajustes_estoque to authenticated;
grant select, insert, update, delete on public.ajustes_estoque to service_role;

create or replace function fn_registrar_ajuste_estoque()
returns trigger as $$
declare
  ja_existe boolean;
begin
  select exists(select 1 from estoque where epi_id = new.epi_id) into ja_existe;

  if ja_existe then
    update estoque set saldo_atual = new.saldo_novo, atualizado_em = now() where epi_id = new.epi_id;
  else
    -- Mesmo caso já tratado em fn_registrar_entrada_estoque: um EPI sem
    -- nenhuma entrada de compra ainda pode não ter linha em `estoque`
    -- (só o trigger de entrada ou este criam essa linha). Aqui pode ser a
    -- primeira vez que ela passa a existir, já com o saldo contado.
    insert into estoque (epi_id, empresa_id, saldo_atual) values (new.epi_id, new.empresa_id, new.saldo_novo);
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

create trigger trg_ajuste_estoque
  after insert on ajustes_estoque
  for each row execute function fn_registrar_ajuste_estoque();

-- ============================================================
-- FIM — depois de rodar, a tela /estoque passa a mostrar o botão
-- "Registrar contagem de estoque" e o lápis de correção ao lado de cada
-- saldo (pra quem for "encarregado" ou mais), sem precisar mexer em mais
-- nada no banco.
-- ============================================================
