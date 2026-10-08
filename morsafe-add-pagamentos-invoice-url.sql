-- ============================================================
-- MorSafe — Nova coluna: pagamentos_empresa.asaas_invoice_url
-- Link da fatura hospedada pelo Asaas (Pix/boleto/cartão) — pra exibir
-- nas telas de Cobranças e da empresa (botão "Ver fatura") sem precisar
-- abrir o painel do Asaas pra achar o link.
--
-- COMO USAR: copie este arquivo inteiro e cole no SQL Editor do Supabase
-- (Project > SQL Editor > New query), clique em "Run".
--
-- Se você ainda não rodou morsafe-pendentes-supabase-TUDO.sql, rode
-- aquele em vez deste — ele já inclui esta coluna junto com tudo mais
-- que falta (tabela assinaturas, asaas_payment_id, asaas_webhook_events).
-- Este arquivo é só pra quem já tem o resto aplicado e precisa só desta
-- coluna nova.
-- ============================================================

alter table pagamentos_empresa
  add column if not exists asaas_invoice_url text;

comment on column pagamentos_empresa.asaas_invoice_url is 'Link da fatura hospedada pelo Asaas (Pix/boleto/cartão). NULL em cobrança sem Asaas por trás, ou ainda não sincronizada.';

-- ============================================================
-- FIM
-- ============================================================
