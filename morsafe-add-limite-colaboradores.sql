-- ============================================================
-- MorSafe — Nova coluna: empresas.limite_colaboradores
-- Limite de colaboradores ATIVOS incluído no plano contratado por cada
-- empresa cliente — usado pro alerta "Empresas no limite" no Dashboard do
-- super_admin e pro aviso na tela de cada empresa (/empresas/[id]), quando
-- o total de colaboradores ativos alcança ou passa esse número (ex.: a
-- empresa cresceu e contratou mais gente do que o plano cobre).
--
-- COMO USAR: copie este arquivo inteiro e cole no SQL Editor do Supabase
-- (Project > SQL Editor > New query), clique em "Run".
--
-- PENDENTE: só pode ser aplicado quando o acesso ao painel do Supabase for
-- recuperado (chamado de suporte aberto desde 28/09/2026, ainda sem
-- resposta). Até lá, o código da aplicação já está pronto e referenciando
-- esta coluna, mas de forma defensiva: toda consulta que busca
-- limite_colaboradores é isolada do resto do resumo da empresa (ver
-- getLimiteColaboradores em src/lib/data/empresas.ts) e trata "coluna não
-- existe" como "sem limite definido" — então nada quebra, só o botão
-- "Definir limite de colaboradores" mostra um aviso claro até este script
-- ser rodado.
-- ============================================================

alter table empresas
  add column limite_colaboradores integer;

comment on column empresas.limite_colaboradores is 'Limite de colaboradores ativos incluído no plano contratado pela empresa cliente. NULL = sem limite definido ainda (não dispara nenhum alerta). Definido manualmente pelo super_admin na tela da empresa (/empresas/[id]) — não é imposto pelo banco (sem CHECK), só usado pra calcular o alerta visual na aplicação.';

-- ============================================================
-- FIM
-- ============================================================
