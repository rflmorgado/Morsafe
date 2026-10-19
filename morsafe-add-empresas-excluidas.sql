-- ============================================================
-- MorSafe — Nova tabela: empresas_excluidas
--
-- Fecha a "Limitação conhecida" documentada em CLAUDE.md (regra 3c) e no
-- comentário de excluirEmpresaPermanentemente (src/app/(app)/empresas/
-- actions.ts): hoje, quando um super_admin exclui definitivamente uma
-- empresa cliente, `log_auditoria` daquela empresa é apagado junto com o
-- resto (não tem como preservar o histórico de uma empresa que deixou de
-- existir — ver comentário completo no código), e por isso não sobrava
-- NENHUM registro durável no banco de "empresa X foi excluída, por quem,
-- quando" — só o log do servidor (Vercel), que não é consultável depois
-- de um tempo. Essa tabela é exatamente esse registro: um snapshot
-- mínimo, gravado como a ÚLTIMA coisa que acontece numa exclusão bem
-- sucedida (depois que a própria empresa já foi apagada), então não tem
-- nenhuma FK pra `empresas` — se tivesse, a própria exclusão que este
-- registro documenta apagaria a prova em cascata.
--
-- RLS: desabilitado por design (mesmo padrão já documentado em `empresas`,
-- ver CLAUDE.md regra 2) — só o super_admin acessa, sempre pelo cliente
-- admin/service role (que ignora RLS de qualquer forma), nunca pelo
-- cliente comum de uma empresa cliente (que nem faz sentido aqui: a
-- empresa já não existe mais pra ter um usuário logado dela).
--
-- COMO USAR: copie este arquivo inteiro e cole no SQL Editor do Supabase
-- (Project > SQL Editor > New query), clique em "Run". Idempotente (usa
-- "if not exists") — pode rodar mais de uma vez sem erro.
-- ============================================================

create table if not exists empresas_excluidas (
  id                uuid primary key default gen_random_uuid(),
  -- Sem "references empresas(id)" de propósito — ver comentário acima.
  empresa_id        uuid not null,
  empresa_nome      text not null,
  empresa_cnpj      text,
  empresa_criada_em timestamptz,
  excluida_em       timestamptz not null default now(),
  -- Snapshot de quem excluiu, não uma FK pra usuarios(id) — pelo mesmo
  -- motivo de não referenciar empresas: mesmo no caso (hoje hipotético) de
  -- esse login vir a ser removido um dia, o registro de quem fez a
  -- exclusão continua legível.
  excluida_por_nome  text not null,
  excluida_por_email text not null,
  -- Contagem de linhas apagadas por tabela (mesmo formato do campo
  -- "resultado" devolvido pela Server Action) — guarda a extensão real da
  -- exclusão, não só o fato de que ela aconteceu.
  resumo             jsonb not null default '{}'::jsonb
);

comment on table empresas_excluidas is 'Snapshot permanente de cada exclusão definitiva de empresa cliente (ver excluirEmpresaPermanentemente, src/app/(app)/empresas/actions.ts) — a única prova durável no banco de que uma empresa existiu e foi excluída, já que log_auditoria dela é apagado junto no mesmo processo. Nunca editada nem apagada depois de gravada.';

-- ============================================================
-- FIM — depois de rodar, a próxima exclusão definitiva de empresa já
-- passa a gravar aqui automaticamente, sem precisar mexer em mais nada.
-- ============================================================
