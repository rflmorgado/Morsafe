-- ============================================================
-- MorSafe — Correções pendentes do checkup de 30/09/2026
-- (itens 1, 7 e 10 — os únicos que dependiam de acesso ao Supabase)
-- Como usar: veja o passo a passo nas seções abaixo. Rode primeiro
-- a PARTE 1 (diagnóstico, só leitura) e me mande o resultado antes
-- de rodar a PARTE 2, caso você queira que eu confirme mais alguma
-- coisa antes. A PARTE 2 já pode ser rodada direto se você preferir
-- seguir sem essa conferência extra — ela foi escrita e revisada
-- linha a linha com base no código atual do app.
-- ============================================================


-- ============================================================
-- PARTE 1 — DIAGNÓSTICO (somente leitura, não altera nada)
-- ============================================================

-- 1a) Confirma se `entregas` realmente tem a coluna `quantidade` em
--     produção. O arquivo morsafe-schema.sql neste repositório NÃO
--     mostra essa coluna na tabela `entregas` (só em `entradas_estoque`),
--     mas o código do app (registrarEntrega, em
--     src/app/(app)/movimentacoes/actions.ts) grava e lê
--     `entregas.quantidade` normalmente — ou seja, essa coluna foi
--     adicionada direto pelo SQL Editor do Supabase em algum momento,
--     sem atualizar o arquivo do schema aqui no repositório.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name in ('entregas', 'devolucoes', 'estoque')
order by table_name, ordinal_position;

-- 1b) Definição atual das 3 funções/triggers de estoque, pra confirmar
--     que não há mais nenhuma diferença em relação ao que está em
--     morsafe-schema.sql além da que já identificamos (o "-1"/"+1" fixo).
select proname, prosrc
from pg_proc
where proname in (
  'fn_registrar_entrega', 'fn_registrar_devolucao', 'fn_registrar_entrada_estoque'
);

-- 1c) RLS ligado/desligado nas tabelas de estoque e nas tabelas de
--     estação/assinatura (estas últimas nem constam em nenhum .sql
--     deste repositório — foram criadas direto no Supabase).
select relname as tabela, relrowsecurity as rls_ligado
from pg_class
where relname in (
  'estoque', 'entregas', 'devolucoes',
  'estacoes_assinatura', 'solicitacoes_assinatura'
);

-- 1d) Colunas reais de estacoes_assinatura e solicitacoes_assinatura —
--     preciso disso pra te devolver o item 10 (documentação + política
--     de RLS) com precisão, em vez de adivinhar pelo código do app.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name in ('estacoes_assinatura', 'solicitacoes_assinatura')
order by table_name, ordinal_position;

-- 1e) Políticas de RLS já existentes (se houver) nessas mesmas tabelas.
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in (
  'estoque', 'entregas', 'devolucoes',
  'estacoes_assinatura', 'solicitacoes_assinatura'
);


-- ============================================================
-- PARTE 2 — CORREÇÃO (itens 1 e 7 do checkup)
-- ============================================================
-- Problema (item 1, "estoque duplicado"): toda entrega/devolução baixava
-- ou devolvia o estoque DUAS vezes — uma vez pela trigger abaixo (que
-- sempre existiu no banco) e outra vez pelo código do app (função
-- ajustarEstoque, em src/app/(app)/movimentacoes/actions.ts, já removida
-- do código nesta mesma entrega — ver instruções de upload que te mandei
-- junto com este arquivo).
--
-- Problema (item 7, "race condition ligada ao mesmo trigger"): a parte
-- do ajustarEstoque que fazia a dupla contagem funcionava com um SELECT
-- seguido de um UPDATE em duas chamadas separadas ao banco — sob
-- concorrência (duas entregas do mesmo EPI ao mesmo tempo), as duas
-- podiam ler o mesmo saldo_atual antes de qualquer uma escrever, e a
-- segunda escrita sobrescrevia a primeira (perdendo uma baixa de
-- estoque). Como o ajustarEstoque foi removido e a trigger abaixo é um
-- único UPDATE/INSERT atômico (o Postgres serializa automaticamente
-- updates concorrentes na mesma linha), esse problema não existe mais
-- depois desta correção — não precisa de nenhuma mudança adicional além
-- da trigger ficar corrigida e ser a única a mexer em `estoque`.
--
-- Bug adicional encontrado ao revisar este ponto (não estava no checkup
-- original, mas é do mesmo lugar): fn_registrar_devolucao() só checava
-- destino = 'reaproveitamento' pra devolver 1 unidade ao estoque — sem
-- checar devolvido_fisicamente. O formulário de devolução permite marcar
-- destino "reaproveitamento" com a caixa "O EPI foi devolvido
-- fisicamente" desmarcada (ver registrar-devolucao-button.tsx) — nesse
-- caso a trigger atual devolve 1 unidade ao estoque mesmo o item nunca
-- tendo voltado fisicamente. A versão corrigida abaixo só devolve ao
-- estoque quando as duas condições são verdadeiras, igual ao código do
-- app já fazia (ver linha "if (devolvidoFisicamente && destino ===
-- 'reaproveitamento')", também removida nesta entrega já que a trigger
-- passa a ser a única responsável).

create or replace function fn_registrar_entrega()
returns trigger as $$
begin
  -- Mantido igual: snapshot do custo médio no momento da entrega.
  if new.custo_unitario_no_momento is null then
    select custo_medio_atual into new.custo_unitario_no_momento from epis where id = new.epi_id;
  end if;

  -- Antes: "update estoque set saldo_atual = saldo_atual - 1" (fixo em 1,
  -- ignorando a coluna quantidade, e não fazia nada se a linha de
  -- `estoque` daquele epi_id ainda não existisse — silenciosamente,
  -- sem erro, porque um UPDATE sem linha correspondente não falha).
  --
  -- Agora: desconta a quantidade real da entrega (coalesce(...,1) é só
  -- uma proteção a mais — a coluna já deveria ser sempre preenchida) e
  -- cria a linha em `estoque` se for a primeira movimentação desse EPI
  -- (papel que antes era do ajustarEstoque, no código do app).
  insert into estoque (epi_id, empresa_id, saldo_atual)
  values (new.epi_id, new.empresa_id, -coalesce(new.quantidade, 1))
  on conflict (epi_id) do update
    set saldo_atual = estoque.saldo_atual - coalesce(new.quantidade, 1),
        atualizado_em = now();

  return new;
end;
$$ language plpgsql;

create or replace function fn_registrar_devolucao()
returns trigger as $$
declare
  qtd_entrega integer;
begin
  if new.destino = 'reaproveitamento' and new.devolvido_fisicamente then
    -- Quantidade vem da entrega vinculada (mesma regra que o app já
    -- seguia: nunca confiar em quantidade digitada de novo no formulário
    -- de devolução — usar sempre o que foi realmente entregue).
    select quantidade into qtd_entrega from entregas where id = new.entrega_vinculada_id;

    update estoque
      set saldo_atual = saldo_atual + coalesce(qtd_entrega, 1),
          atualizado_em = now()
      where epi_id = new.epi_id;
  end if;

  return new;
end;
$$ language plpgsql;

-- As duas triggers (trg_entrega_baixa_estoque, trg_devolucao_estoque) já
-- apontam pra essas funções pelo nome — "create or replace function" é
-- suficiente, não precisa recriar as triggers.


-- ============================================================
-- PARTE 3 — ITEM 10 (RLS das tabelas de estação/assinatura)
-- ============================================================
-- Ainda não escrevo a política de RLS definitiva aqui porque
-- `estacoes_assinatura` e `solicitacoes_assinatura` não existem em
-- NENHUM arquivo .sql deste repositório — foram criadas direto no
-- SQL Editor do Supabase, então não tenho a definição de coluna dessas
-- tabelas nem sei se o RLS está ligado ou desligado nelas hoje (poderia
-- estar ligado e sem nenhuma policy, que é exatamente o cenário de falha
-- silenciosa que o CLAUDE.md deste projeto pede pra nunca aceitar por
-- reflexo — ver regra 2).
--
-- Me manda o resultado das consultas 1c, 1d e 1e da Parte 1 (ou só peça
-- pra eu rodar quando o acesso ao Supabase voltar) que eu volto com:
--   a) a definição das duas tabelas documentada em morsafe-schema.sql
--      (hoje ausente, o que por si só já é uma lacuna de documentação);
--   b) a política de RLS certa pra elas (isolamento por empresa via
--      auth_empresa_id(), no mesmo padrão já usado no resto do banco —
--      ou, se for o caso, RLS desabilitado por design com o motivo
--      documentado, igual já é feito em `empresas` e
--      `verificacoes_documento`).
