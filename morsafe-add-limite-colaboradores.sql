-- ============================================================
-- MorSafe — Nova coluna: empresas.limite_colaboradores
-- Limite de colaboradores ATIVOS incluído no plano contratado por cada
-- empresa cliente — usado pro alerta "Empresas no limite" no Dashboard do
-- super_admin e pro aviso na tela de cada empresa (/empresas/[id]), quando
-- o total de colaboradores ativos alcança ou passa esse número (ex.: a
-- empresa cresceu e contratou mais gente do que o plano cobre).
--
-- JÁ APLICADO em produção, em 14/10/2026 (ver morsafe-bootstrap-projeto-
-- novo.sql, que inclui esta mesma coluna) — este arquivo fica aqui como
-- registro histórico de incremento e pra reaplicar em qualquer banco onde
-- ainda falte (ex.: um ambiente de teste criado à parte). Idempotente (usa
-- "if not exists") — pode rodar mais de uma vez sem erro, mesmo que a
-- coluna já exista. O código da aplicação referencia esta coluna de forma
-- defensiva mesmo assim: toda consulta que busca limite_colaboradores é
-- isolada do resto do resumo da empresa (ver getLimiteColaboradores em
-- src/lib/data/empresas.ts) e trata "coluna não existe" como "sem limite
-- definido" — rede de segurança pra um banco onde este script não tenha
-- rodado ainda, não o caso normal.
--
-- COMO USAR: copie este arquivo inteiro e cole no SQL Editor do Supabase
-- (Project > SQL Editor > New query), clique em "Run".
-- ============================================================

alter table empresas
  add column if not exists limite_colaboradores integer;

comment on column empresas.limite_colaboradores is 'Limite de colaboradores ativos incluído no plano contratado pela empresa cliente. NULL = sem limite definido ainda (não dispara nenhum alerta). Definido manualmente pelo super_admin na tela da empresa (/empresas/[id]) — não é imposto pelo banco (sem CHECK), só usado pra calcular o alerta visual na aplicação.';

-- ============================================================
-- FIM
-- ============================================================
