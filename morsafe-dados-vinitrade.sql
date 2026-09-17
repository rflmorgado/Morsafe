-- ============================================================
-- MorSafe — Dados da Vinitrade (EPI, Silk Screen, correção de setor)
-- Rode DEPOIS de morsafe-schema.sql e morsafe-dados.sql
-- Baseado no PGR ViniTrade 2026/2027
-- ============================================================

begin;

-- 1. Novo EPI (único item realmente novo do PGR Vinitrade)
insert into epis (empresa_id, nome, ca, exige_ca)
select e.id, 'Respirador semifacial 3M (vapores orgânicos - combinado)', '12011', true
from empresas e where e.nome = 'ViniPlast Indústria e Comércio de Lonas Ltda.'
on conflict do nothing;

-- 2. Novo setor: Silk Screen (separado de Confecção — risco químico distinto, exige respirador)
insert into setores (empresa_id, unidade_id, nome)
select e.id, u.id, 'SILK SCREEN'
from empresas e
join unidades u on u.empresa_id = e.id and u.nome = 'Vinitrade'
where e.nome = 'ViniPlast Indústria e Comércio de Lonas Ltda.'
on conflict do nothing;

-- 2.1 Setor Serviços Gerais da Vinitrade (previsto no PGR, sem colaboradores no momento)
insert into setores (empresa_id, unidade_id, nome)
select e.id, u.id, 'SERVIÇOS GERAIS'
from empresas e
join unidades u on u.empresa_id = e.id and u.nome = 'Vinitrade'
where e.nome = 'ViniPlast Indústria e Comércio de Lonas Ltda.'
on conflict do nothing;

-- 3. Novo cargo "OP. DE SILK SCREEN JR." vinculado ao setor Silk Screen (não mais Confecção)
insert into cargos (empresa_id, setor_id, nome)
select s.empresa_id, s.id, 'OP. DE SILK SCREEN JR.'
from setores s
join unidades u on u.id = s.unidade_id and u.nome = 'Vinitrade'
where s.nome = 'SILK SCREEN'
on conflict do nothing;

-- 4. Move a Viviane (e qualquer futuro colaborador com esse cargo) para o setor correto
update colaboradores c
set setor_id = (
      select s.id from setores s
      join unidades u on u.id = s.unidade_id and u.nome = 'Vinitrade'
      where s.nome = 'SILK SCREEN'
    ),
    cargo_id = (
      select cg.id from cargos cg
      join setores s2 on s2.id = cg.setor_id
      join unidades u2 on u2.id = s2.unidade_id and u2.nome = 'Vinitrade'
      where s2.nome = 'SILK SCREEN' and cg.nome = 'OP. DE SILK SCREEN JR.'
    ),
    atualizado_em = now()
where c.nome ilike 'Viviane Coelho Chagas de Melo';

-- 5. Vínculo Setor x EPI — Vinitrade (usando os nomes já existentes no catálogo consolidado)
insert into setor_epi (empresa_id, setor_id, epi_id, obrigatorio)
select s.empresa_id, s.id, ep.id, true
from (values
  ('CONFECÇÃO',       'Calçado de segurança composite'),
  ('CONFECÇÃO',       'Luva microfoam'),
  ('SILK SCREEN',     'Calçado de segurança composite'),
  ('SILK SCREEN',     'Luva nitrílica c/ forro'),
  ('SILK SCREEN',     'Respirador semifacial 3M (vapores orgânicos - combinado)'),
  ('SILK SCREEN',     'Luva química'),
  ('SILK SCREEN',     'Sapato EVA PTO'),
  ('SILK SCREEN',     'Óculos comum incolor'),
  ('PCP',              'Calçado de segurança composite'),
  ('QUALIDADE',        'Calçado de segurança composite'),
  ('PORTARIA',         'Calçado de segurança composite'),
  ('VINITELA',         'Calçado de segurança composite'),
  ('SERVIÇOS GERAIS',  'Calçado de segurança composite'),
  ('SERVIÇOS GERAIS',  'Luva nitrílica c/ forro')
) as x(setor, epi)
join unidades u on u.nome = 'Vinitrade'
join setores s on s.unidade_id = u.id and s.nome = x.setor
join epis ep on ep.nome = x.epi and ep.empresa_id = s.empresa_id
on conflict do nothing;

commit;

-- ============================================================
-- FIM — ver observações no chat sobre o CA 37168 compartilhado
-- entre "Luva Microfoam" e "Luva Flextactil Black" antes de
-- considerar este cadastro 100% validado.
-- ============================================================
