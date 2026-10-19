-- ============================================================
-- MorSafe — Nova coluna: entregas.grupo_entrega_id
--
-- Agrupa visualmente, na ficha do colaborador (PDF) e nos relatórios,
-- várias entregas de EPI feitas de uma vez só no mesmo pedido (botão
-- "+ Adicionar outro item", ver registrarEntrega em
-- app/(app)/movimentacoes/actions.ts) — hoje cada item vira sua própria
-- linha em `entregas` (uma linha = um EPI, pra poder devolver um item do
-- lote sem mexer nos outros), e esta coluna é o que deixa a ficha saber
-- que N linhas vieram do MESMO pedido e desenhar isso como um bloco só
-- (um título "Entrega — N itens", uma assinatura só), em vez de N blocos
-- quase idênticos repetindo a mesma miniatura de assinatura — ver
-- desenharBlocoEntregaAgrupada em
-- app/(app)/colaboradores/[id]/ficha/route.ts.
--
-- O código da aplicação já referencia esta coluna há um tempo, de forma
-- defensiva (ver comentários em registrarEntrega,
-- movimentacoes/actions.ts, e getHistoricoColaborador,
-- lib/data/colaboradores.ts): se o INSERT/SELECT falhar com "coluna não
-- existe" (42703/PGRST204), o código detecta isso e refaz a operação sem
-- a coluna — nenhuma entrega deixou de ser registrada por causa disso,
-- só a agrupação visual na ficha nunca chegou a aparecer, porque esta
-- coluna nunca tinha sido criada em nenhum dos dois projetos Supabase
-- (nem o antigo, nem o novo criado em 13/10/2026 — confirmado revisando
-- morsafe-schema.sql e morsafe-bootstrap-projeto-novo.sql em 19/10/2026).
--
-- COMO USAR: copie este arquivo inteiro e cole no SQL Editor do Supabase
-- (Project > SQL Editor > New query), clique em "Run". Idempotente (usa
-- "if not exists") — pode rodar mais de uma vez sem erro.
-- ============================================================

alter table entregas
  add column if not exists grupo_entrega_id uuid;

comment on column entregas.grupo_entrega_id is 'Agrupa as linhas de entregas feitas no mesmo pedido (vários EPIs entregues de uma vez) — todas as linhas do mesmo pedido compartilham o mesmo valor. NULL em entregas avulsas (um item só) e em todo histórico registrado antes desta coluna existir; o código trata os dois casos da mesma forma (desenha como entrega de item único). Gerado com crypto.randomUUID() na aplicação, nunca default do banco.';

-- ============================================================
-- FIM — depois de rodar, novas entregas com mais de um item passam a
-- aparecer agrupadas na ficha automaticamente, sem precisar mexer em
-- mais nada no código (o fallback existente simplesmente para de
-- disparar).
-- ============================================================
