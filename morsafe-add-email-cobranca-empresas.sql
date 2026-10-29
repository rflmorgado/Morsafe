-- ============================================================
-- MorSafe — Nova coluna: empresas.email_cobranca
-- E-mail de cobrança ADICIONAL da empresa cliente, separado do e-mail de
-- login do admin (que continua vindo de usuarios/Supabase Auth, nunca
-- desta coluna) — pedido do Rafael, 29/10/2026: deixar a empresa indicar
-- um e-mail diferente (ex. um financeiro@) que também recebe as
-- notificações de cobrança do Asaas, sem precisar trocar o e-mail de
-- login pra isso. Editável pelo próprio admin da empresa em /empresa (ver
-- EmailCobrancaForm, app/(app)/empresa/email-cobranca-form.tsx), que ao
-- salvar também atualiza o campo additionalEmails do cliente no Asaas
-- (ver atualizarClienteAsaas, lib/asaas/client.ts, e
-- atualizarEmailCobrancaEmpresa, app/(app)/empresa/actions.ts).
--
-- Aceita mais de um e-mail, separados por vírgula — mesmo formato exigido
-- pelo additionalEmails do Asaas, salvo aqui como string única pra não
-- precisar de uma tabela nova só pra isso.
--
-- COMO USAR: copie este arquivo inteiro e cole no SQL Editor do Supabase
-- (Project > SQL Editor > New query), clique em "Run". Idempotente (usa
-- "if not exists") — pode rodar mais de uma vez sem erro, mesmo que a
-- coluna já exista.
-- ============================================================

alter table empresas
  add column if not exists email_cobranca text;

comment on column empresas.email_cobranca is 'E-mail(s) de cobrança ADICIONAL da empresa cliente, separados por vírgula se mais de um — nunca substitui o e-mail de login do admin, só soma. NULL = empresa nunca configurou um (caso normal, hoje). Editável pelo admin da empresa em /empresa; ao salvar, também sincroniza com o campo additionalEmails do cliente no Asaas (ver atualizarClienteAsaas, lib/asaas/client.ts).';

-- ============================================================
-- FIM
-- ============================================================
