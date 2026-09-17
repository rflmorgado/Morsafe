-- ============================================================
-- MorSafe — Dados iniciais (ViniPlast + Vinitrade)
-- Rode este script DEPOIS do morsafe-schema.sql
-- ============================================================

begin;

-- 1. Empresa (tenant)
insert into empresas (nome) values ('ViniPlast Indústria e Comércio de Lonas Ltda.')
  on conflict do nothing;

-- 2. Unidades (filiais)
insert into unidades (empresa_id, nome)
select id, 'ViniPlast' from empresas where nome = 'ViniPlast Indústria e Comércio de Lonas Ltda.'
on conflict do nothing;
insert into unidades (empresa_id, nome)
select id, 'Vinitrade' from empresas where nome = 'ViniPlast Indústria e Comércio de Lonas Ltda.'
on conflict do nothing;

-- 3. Setores — unidade ViniPlast
insert into setores (empresa_id, unidade_id, nome)
select e.id, u.id, x.nome
from (values
  ('AUTOMAÇÃO'),
  ('EXTRUSÃO'),
  ('LOGÍSTICA'),
  ('MANUTENÇÃO'),
  ('PCP'),
  ('PESAGEM'),
  ('PICOTADOR'),
  ('PORTARIA'),
  ('QUALIDADE'),
  ('REVISÃO'),
  ('SERVIÇOS GERAIS'),
  ('SUPRIMENTOS')
) as x(nome)
join empresas e on e.nome = 'ViniPlast Indústria e Comércio de Lonas Ltda.'
join unidades u on u.empresa_id = e.id and u.nome = 'ViniPlast'
on conflict do nothing;

-- 3.1 Setores — unidade Vinitrade
insert into setores (empresa_id, unidade_id, nome)
select e.id, u.id, x.nome
from (values
  ('CONFECÇÃO'),
  ('PCP'),
  ('PORTARIA'),
  ('QUALIDADE'),
  ('VINITELA')
) as x(nome)
join empresas e on e.nome = 'ViniPlast Indústria e Comércio de Lonas Ltda.'
join unidades u on u.empresa_id = e.id and u.nome = 'Vinitrade'
on conflict do nothing;

-- 4. Cargos — unidade ViniPlast
insert into cargos (empresa_id, setor_id, nome)
select s.empresa_id, s.id, x.cargo
from (values
  ('AUTOMAÇÃO', 'ASSISTENTE ADMINISTRATIVO'),
  ('AUTOMAÇÃO', 'TEC. AUTOMAÇÃO JR.'),
  ('EXTRUSÃO', 'ABASTECEDOR DE PRODUÇÃO'),
  ('EXTRUSÃO', 'APONTADOR(A) DE PRODUÇÃO'),
  ('EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('EXTRUSÃO', 'AUX. DE PRODUÇÃO'),
  ('EXTRUSÃO', 'COORDENADOR DE EXTRUSÃO'),
  ('EXTRUSÃO', 'OP. DE EXTRUSÃO JR.'),
  ('EXTRUSÃO', 'OP. DE EXTRUSÃO SR.'),
  ('EXTRUSÃO', 'REVISOR DE EXTRUSÃO PL.'),
  ('EXTRUSÃO', 'SUP. DE EXTRUSÃO JR.'),
  ('EXTRUSÃO', 'SUP. DE EXTRUSÃO PL.'),
  ('EXTRUSÃO', 'SUP. DE EXTRUSÃO SR.'),
  ('LOGÍSTICA', 'ASSISTENTE DE FATURAMENTO'),
  ('LOGÍSTICA', 'AUX. DE EXPEDIÇÃO'),
  ('LOGÍSTICA', 'CONF. DE LOGÍSTICA JR.'),
  ('LOGÍSTICA', 'SUP. DE LOGISTICA'),
  ('MANUTENÇÃO', 'AUX. DE MANUTENÇÃO'),
  ('MANUTENÇÃO', 'ELETRICISTA MANUT. PL.'),
  ('MANUTENÇÃO', 'MECÂNICO DE MAN. JR.'),
  ('MANUTENÇÃO', 'MECÂNICO DE MAN. PL.'),
  ('MANUTENÇÃO', 'MECÂNICO DE MAN. SR.'),
  ('PCP', 'ANALISTA DE PCP SR.'),
  ('PCP', 'AUX. DE PCP'),
  ('PESAGEM', 'AUX. DE PESAGEM'),
  ('PESAGEM', 'SUPERVISOR(A) DE PESAGEM'),
  ('PICOTADOR', 'AUX. DE PRODUÇÃO'),
  ('PORTARIA', 'PORTEIRO'),
  ('QUALIDADE', 'ANALISTA DE QUALIDADE SR.'),
  ('QUALIDADE', 'ASSISTENTE ADMINISTRATIVO'),
  ('QUALIDADE', 'ASSISTENTE DE QUALIDADE'),
  ('QUALIDADE', 'SUP. DE QUALIDADE'),
  ('REVISÃO', 'AUX. DE REVISÃO'),
  ('REVISÃO', 'AUX. DE REVISÃO JR.'),
  ('REVISÃO', 'REVISOR DE EXTRUSÃO JR.'),
  ('REVISÃO', 'REVISOR DE EXTRUSÃO PL.'),
  ('REVISÃO', 'REVISOR DE EXTRUSÃO SR.'),
  ('SERVIÇOS GERAIS', 'AUX. DE LIMPEZA'),
  ('SUPRIMENTOS', 'ANALISTA DE RECEBIMENTO JR.'),
  ('SUPRIMENTOS', 'ASSIS. DE ALMOXARIFADO'),
  ('SUPRIMENTOS', 'ASSISTENTE DE COMPRAS'),
  ('SUPRIMENTOS', 'AUXILIAR DE ESCRITORIO')
) as x(setor, cargo)
join unidades u on u.nome = 'ViniPlast'
join setores s on s.unidade_id = u.id and s.nome = x.setor
on conflict do nothing;

-- 4. Cargos — unidade Vinitrade
insert into cargos (empresa_id, setor_id, nome)
select s.empresa_id, s.id, x.cargo
from (values
  ('CONFECÇÃO', 'ANAL. DE LOGISTICA JR.'),
  ('CONFECÇÃO', 'ASSIS. DE EXPEDIÇÃO'),
  ('CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('CONFECÇÃO', 'AUX. DE MAQ. DE ILHÓSES JR.'),
  ('CONFECÇÃO', 'AUX. DE MÁQUINA SOLDA JR.'),
  ('CONFECÇÃO', 'AUX. DE REVISÃO'),
  ('CONFECÇÃO', 'COORDENADOR DE CONFECÇÃO'),
  ('CONFECÇÃO', 'COSTUREIRA JR.'),
  ('CONFECÇÃO', 'COSTUREIRA SR.'),
  ('CONFECÇÃO', 'COSTUREIRO (A) JUNIOR'),
  ('CONFECÇÃO', 'OP. DE CORTE JR.'),
  ('CONFECÇÃO', 'OP. DE MAQ. DE ILHÓSES JR.'),
  ('CONFECÇÃO', 'OP. DE MAQ. DE SOLDA JR.'),
  ('CONFECÇÃO', 'OP. DE MAQ. DE SOLDA SR.'),
  ('CONFECÇÃO', 'OP. DE SILK SCREEN JR.'),
  ('CONFECÇÃO', 'OP. DE SUPORTE PRODUTIVO'),
  ('CONFECÇÃO', 'REVISOR DE CONFECÇÃO JR.'),
  ('CONFECÇÃO', 'SUP. DE CONFECÇÃO JR.'),
  ('PCP', 'ANALISTA DE PCP PL.'),
  ('PORTARIA', 'PORTEIRO'),
  ('QUALIDADE', 'ASSISTENTE DE QUALIDADE'),
  ('VINITELA', 'AUX. DE PRODUÇÃO'),
  ('VINITELA', 'OP. DE MAQUINAS')
) as x(setor, cargo)
join unidades u on u.nome = 'Vinitrade'
join setores s on s.unidade_id = u.id and s.nome = x.setor
on conflict do nothing;

-- 5. Catálogo mestre de EPI
insert into epis (empresa_id, nome, ca, exige_ca)
select e.id, x.nome, x.ca, x.exige_ca
from (values
  ('Sapato EVA PTO', '39213', true),
  ('Avental de raspa', '32591', true),
  ('Calça de segurança NR10', null, true),
  ('Calçado de segurança composite', '33753', true),
  ('Camisa de segurança NR10', null, true),
  ('Capuz de soldador brim azul', '50464', true),
  ('Luva de vinil cirúrgica', '20722', true),
  ('Luva de vaqueta', '16474', true),
  ('Luva microfoam', '37168', true),
  ('Luva multiuso tricotada 4 fios', '50389', true),
  ('Luva nitrílica c/ forro', '16313', true),
  ('Luva nitrílica s/ forro', '16314', true),
  ('Luva química', '51279', true),
  ('Luva resistente a corte', '49201', true),
  ('Luva tátil preta', '29014', true),
  ('Macacão de Tyvek', '20662', true),
  ('Mangote de segurança', '13395', true),
  ('Óculos ampla visão', '19628', true),
  ('Óculos comum incolor', '11268', true),
  ('Protetor auricular tipo concha', '33135', true),
  ('Protetor auricular tipo silicone', '18189', true),
  ('Respirador Elipse P3 - poeiras e névoas', '29416', true),
  ('Respirador Alltec - vapores orgânicos', '33596', true),
  ('Respirador PFF3', '38503', true),
  ('Protetor facial', '15019', true),
  ('Máscara de solda', '47764', true),
  ('Camisa de segurança', '50038', true),
  ('Calça de segurança', '50039', true),
  ('Balaclava', null, false),
  ('Blusão de raspa solda', null, true),
  ('Filtro Altek - vapores orgânicos', null, true),
  ('Filtro Elipse AE1 - vapores orgânicos', null, true),
  ('Filtro Elipse P3 - poeiras e névoas', null, true),
  ('Luva de Kevlar temperatura', null, true),
  ('Respirador Elipse AE1 - vapores orgânicos', null, true)
) as x(nome, ca, exige_ca)
join empresas e on e.nome = 'ViniPlast Indústria e Comércio de Lonas Ltda.'
on conflict do nothing;

-- 6. Entrada de estoque inicial (dispara o cálculo automático de custo médio)
-- Quantidade inicial padrão de 20 unidades para dar partida no saldo; ajuste depois com a contagem real.
insert into entradas_estoque (empresa_id, epi_id, quantidade, preco_unitario, fornecedor, nota_fiscal)
select emp.id, ep.id, x.quantidade, x.preco, 'Carga inicial', 'SEED-2026'
from (values
  ('Calça de segurança NR10', 20, 130.0),
  ('Calçado de segurança composite', 20, 57.0),
  ('Camisa de segurança NR10', 20, 130.0),
  ('Luva de vinil cirúrgica', 20, 22.77),
  ('Luva de vaqueta', 20, 13.8),
  ('Luva microfoam', 20, 24.3),
  ('Luva multiuso tricotada 4 fios', 20, 2.0),
  ('Luva nitrílica c/ forro', 20, 8.38),
  ('Luva nitrílica s/ forro', 20, 7.6),
  ('Luva resistente a corte', 20, 20.7),
  ('Luva tátil preta', 20, 2.98),
  ('Macacão de Tyvek', 20, 13.92),
  ('Mangote de segurança', 20, 13.6),
  ('Óculos ampla visão', 20, 79.0),
  ('Óculos comum incolor', 20, 3.9),
  ('Protetor auricular tipo concha', 20, 25.6),
  ('Protetor auricular tipo silicone', 20, 1.15),
  ('Respirador Elipse P3 - poeiras e névoas', 20, 80.0),
  ('Respirador Alltec - vapores orgânicos', 20, 37.21),
  ('Balaclava', 20, 15.0),
  ('Blusão de raspa solda', 20, 93.0),
  ('Filtro Altek - vapores orgânicos', 20, 12.25),
  ('Filtro Elipse AE1 - vapores orgânicos', 20, 56.9),
  ('Filtro Elipse P3 - poeiras e névoas', 20, 32.2),
  ('Luva de Kevlar temperatura', 20, 14.78),
  ('Respirador Elipse AE1 - vapores orgânicos', 20, 315.2)
) as x(nome, quantidade, preco)
join epis ep on ep.nome = x.nome
join empresas emp on emp.id = ep.empresa_id;

-- 7. Vínculo Setor x EPI obrigatório (somente ViniPlast — Vinitrade aguarda PGR próprio)
insert into setor_epi (empresa_id, setor_id, epi_id, obrigatorio)
select s.empresa_id, s.id, ep.id, true
from (values
  ('AUTOMAÇÃO', 'Avental de raspa'),
  ('AUTOMAÇÃO', 'Calça de segurança'),
  ('AUTOMAÇÃO', 'Calçado de segurança composite'),
  ('AUTOMAÇÃO', 'Camisa de segurança'),
  ('AUTOMAÇÃO', 'Luva de vaqueta'),
  ('AUTOMAÇÃO', 'Luva química'),
  ('AUTOMAÇÃO', 'Máscara de solda'),
  ('AUTOMAÇÃO', 'Protetor auricular tipo silicone'),
  ('AUTOMAÇÃO', 'Protetor facial'),
  ('AUTOMAÇÃO', 'Óculos comum incolor'),
  ('EXTRUSÃO', 'Calçado de segurança composite'),
  ('EXTRUSÃO', 'Filtro Altek - vapores orgânicos'),
  ('EXTRUSÃO', 'Luva de Kevlar temperatura'),
  ('EXTRUSÃO', 'Luva multiuso tricotada 4 fios'),
  ('EXTRUSÃO', 'Luva química'),
  ('EXTRUSÃO', 'Mangote de segurança'),
  ('EXTRUSÃO', 'Protetor auricular tipo silicone'),
  ('EXTRUSÃO', 'Respirador Alltec - vapores orgânicos'),
  ('EXTRUSÃO', 'Respirador PFF3'),
  ('EXTRUSÃO', 'Óculos comum incolor'),
  ('LOGÍSTICA', 'Calçado de segurança composite'),
  ('LOGÍSTICA', 'Luva microfoam'),
  ('MANUTENÇÃO', 'Avental de raspa'),
  ('MANUTENÇÃO', 'Blusão de raspa solda'),
  ('MANUTENÇÃO', 'Calça de segurança'),
  ('MANUTENÇÃO', 'Calça de segurança NR10'),
  ('MANUTENÇÃO', 'Calçado de segurança composite'),
  ('MANUTENÇÃO', 'Camisa de segurança'),
  ('MANUTENÇÃO', 'Camisa de segurança NR10'),
  ('MANUTENÇÃO', 'Luva de vaqueta'),
  ('MANUTENÇÃO', 'Luva química'),
  ('MANUTENÇÃO', 'Máscara de solda'),
  ('MANUTENÇÃO', 'Protetor auricular tipo silicone'),
  ('MANUTENÇÃO', 'Protetor facial'),
  ('MANUTENÇÃO', 'Óculos comum incolor'),
  ('PCP', 'Calçado de segurança composite'),
  ('PCP', 'Protetor auricular tipo silicone'),
  ('PESAGEM', 'Balaclava'),
  ('PESAGEM', 'Calçado de segurança composite'),
  ('PESAGEM', 'Filtro Elipse P3 - poeiras e névoas'),
  ('PESAGEM', 'Luva de vinil cirúrgica'),
  ('PESAGEM', 'Luva nitrílica s/ forro'),
  ('PESAGEM', 'Luva química'),
  ('PESAGEM', 'Macacão de Tyvek'),
  ('PESAGEM', 'Respirador Elipse P3 - poeiras e névoas'),
  ('PESAGEM', 'Respirador PFF3'),
  ('PESAGEM', 'Óculos ampla visão'),
  ('PICOTADOR', 'Calçado de segurança composite'),
  ('PICOTADOR', 'Luva multiuso tricotada 4 fios'),
  ('PICOTADOR', 'Luva química'),
  ('PICOTADOR', 'Protetor auricular tipo concha'),
  ('PICOTADOR', 'Óculos comum incolor'),
  ('PORTARIA', 'Calçado de segurança composite'),
  ('QUALIDADE', 'Calçado de segurança composite'),
  ('QUALIDADE', 'Luva multiuso tricotada 4 fios'),
  ('QUALIDADE', 'Protetor auricular tipo silicone'),
  ('QUALIDADE', 'Respirador PFF3'),
  ('REVISÃO', 'Calçado de segurança composite'),
  ('REVISÃO', 'Protetor auricular tipo silicone'),
  ('SERVIÇOS GERAIS', 'Calçado de segurança composite'),
  ('SERVIÇOS GERAIS', 'Luva nitrílica c/ forro'),
  ('SUPRIMENTOS', 'Calçado de segurança composite'),
  ('SUPRIMENTOS', 'Protetor auricular tipo silicone')
) as x(setor, epi)
join unidades u on u.nome = 'ViniPlast'
join setores s on s.unidade_id = u.id and s.nome = x.setor
join epis ep on ep.nome = x.epi and ep.empresa_id = s.empresa_id
on conflict do nothing;

-- 8. Colaboradores — unidade ViniPlast (82 pessoas)
-- CPF e telefone não vieram na planilha — ficam NULL, a preencher depois no cadastro.
insert into colaboradores (empresa_id, setor_id, cargo_id, nome, status)
select s.empresa_id, s.id, c.id, x.nome, 'ativo'
from (values
  ('Ademir Gomes De Souza', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('Adriano Carvalho', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('Alessandro Miranda Barbosa', 'PORTARIA', 'PORTEIRO'),
  ('Alex Sandro De Arruda Rosa', 'EXTRUSÃO', 'ABASTECEDOR DE PRODUÇÃO'),
  ('Anderson De Souza', 'PICOTADOR', 'AUX. DE PRODUÇÃO'),
  ('Anderson Roberto Costa Junior', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('Andre Luis Aparecido Do Prado', 'LOGÍSTICA', 'CONF. DE LOGÍSTICA JR.'),
  ('Andreson Correia Reis', 'EXTRUSÃO', 'SUP. DE EXTRUSÃO JR.'),
  ('Antonio Gomes Fortuna', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('Antony Gabriel Da Silva Gomes', 'PCP', 'ANALISTA DE PCP SR.'),
  ('Aramis Eduardo Pereira Leal', 'EXTRUSÃO', 'SUP. DE EXTRUSÃO JR.'),
  ('Arilson Aparecido Aguiar', 'LOGÍSTICA', 'AUX. DE EXPEDIÇÃO'),
  ('Ataide De Souza Junior', 'EXTRUSÃO', 'ABASTECEDOR DE PRODUÇÃO'),
  ('Breno Kaique Soares Lopes De Oliveira', 'REVISÃO', 'AUX. DE REVISÃO'),
  ('Carlos Daniel De Lima Moises', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('Celio Divino Antonio Junior', 'EXTRUSÃO', 'SUP. DE EXTRUSÃO PL.'),
  ('Claudinei Hipolito De Oliveira', 'MANUTENÇÃO', 'MECÂNICO DE MAN. SR.'),
  ('Cleber Fernando Moreira', 'PICOTADOR', 'AUX. DE PRODUÇÃO'),
  ('Cristiano Aparecido Pedroso Moraes', 'LOGÍSTICA', 'CONF. DE LOGÍSTICA JR.'),
  ('Cristiano De Lima', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('Davi Bertuol', 'QUALIDADE', 'ASSISTENTE DE QUALIDADE'),
  ('Decleves Jose Dos Santos Junior', 'AUTOMAÇÃO', 'TEC. AUTOMAÇÃO JR.'),
  ('Diego Vaz De Barros Frick', 'PICOTADOR', 'AUX. DE PRODUÇÃO'),
  ('Domingos Rogerio Muniz Bruzaca Coutinho', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('Edeson Wilson Pedro', 'MANUTENÇÃO', 'ELETRICISTA MANUT. PL.'),
  ('Edinilson Soares', 'EXTRUSÃO', 'COORDENADOR DE EXTRUSÃO'),
  ('Edmilson Barros De Oliveira', 'LOGÍSTICA', 'CONF. DE LOGÍSTICA JR.'),
  ('Eduardo Gomes De Oliveira', 'EXTRUSÃO', 'ABASTECEDOR DE PRODUÇÃO'),
  ('Elias Savio Junior', 'LOGÍSTICA', 'ASSISTENTE DE FATURAMENTO'),
  ('Elison De Araujo Lino', 'PORTARIA', 'PORTEIRO'),
  ('Everton De Oliveira Almeida', 'EXTRUSÃO', 'OP. DE EXTRUSÃO JR.'),
  ('Everton Noronha Silva', 'SUPRIMENTOS', 'ANALISTA DE RECEBIMENTO JR.'),
  ('Ezequiel Nunes Da Silva', 'REVISÃO', 'REVISOR DE EXTRUSÃO SR.'),
  ('Fabiana Mendes Branco', 'PESAGEM', 'SUPERVISOR(A) DE PESAGEM'),
  ('Fabiana Tome', 'PESAGEM', 'AUX. DE PESAGEM'),
  ('Felipe Machado De Lima', 'QUALIDADE', 'ASSISTENTE DE QUALIDADE'),
  ('Gabriel Zanitti Dos Santos', 'LOGÍSTICA', 'AUX. DE EXPEDIÇÃO'),
  ('Geovani Gabriel Nunes Benedito', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('Gilmar Dos Santos Silva', 'EXTRUSÃO', 'OP. DE EXTRUSÃO JR.'),
  ('Henrique Morales', 'MANUTENÇÃO', 'AUX. DE MANUTENÇÃO'),
  ('Igor Gabriel Sazatornil Chiva Do Carmo', 'REVISÃO', 'REVISOR DE EXTRUSÃO JR.'),
  ('Isaac Cavalcante De Sousa Gondim', 'REVISÃO', 'AUX. DE REVISÃO'),
  ('Ivan Soares Borges', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('Izabela Miranda De Sousa', 'SUPRIMENTOS', 'AUXILIAR DE ESCRITORIO'),
  ('Joao Batista Marcos', 'MANUTENÇÃO', 'MECÂNICO DE MAN. JR.'),
  ('John Lenon Franco De Morais', 'LOGÍSTICA', 'SUP. DE LOGISTICA'),
  ('Josilene Maria Da Silva Nascimento', 'EXTRUSÃO', 'APONTADOR(A) DE PRODUÇÃO'),
  ('José Henrique Pereira De Castro', 'EXTRUSÃO', 'AUX. DE PRODUÇÃO'),
  ('José Paulo Ribeiro Curaça', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('José Valberio Lopes', 'PICOTADOR', 'AUX. DE PRODUÇÃO'),
  ('Juliano Damasceno Rodrigues De Oliveira', 'PESAGEM', 'AUX. DE PESAGEM'),
  ('Kaiky Alef Camargo Gomes', 'QUALIDADE', 'ASSISTENTE DE QUALIDADE'),
  ('Kauã Alexandre Canavezzi Dos Santos Chagas', 'REVISÃO', 'REVISOR DE EXTRUSÃO PL.'),
  ('Kauan De Campos Feijó', 'REVISÃO', 'AUX. DE REVISÃO'),
  ('Keyth Gabrielle Silva De Camargo', 'SUPRIMENTOS', 'ASSISTENTE DE COMPRAS'),
  ('Leonardo Alisson Cabral', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('Lucas De Oliveira Jorge', 'SUPRIMENTOS', 'ASSIS. DE ALMOXARIFADO'),
  ('Lucas Tolentino Lima', 'QUALIDADE', 'ANALISTA DE QUALIDADE SR.'),
  ('Luciana Aparecida Ornelas Da Costa', 'EXTRUSÃO', 'APONTADOR(A) DE PRODUÇÃO'),
  ('Marcos Victor Silveira Mello', 'REVISÃO', 'AUX. DE REVISÃO'),
  ('Maria Helena Evaristo Teixeira', 'QUALIDADE', 'SUP. DE QUALIDADE'),
  ('Miguel Angelo Jaquetta', 'PORTARIA', 'PORTEIRO'),
  ('Micael Renan Braz José', 'REVISÃO', 'AUX. DE REVISÃO'),
  ('Murilo Mateus Da Silva', 'REVISÃO', 'AUX. DE REVISÃO'),
  ('Nayara Estela Faria Da Rosa', 'EXTRUSÃO', 'APONTADOR(A) DE PRODUÇÃO'),
  ('Pablo Emilio De Arruda Rosa', 'QUALIDADE', 'ASSISTENTE ADMINISTRATIVO'),
  ('Pedro Henrique Gil Martins', 'AUTOMAÇÃO', 'ASSISTENTE ADMINISTRATIVO'),
  ('Peterson Lucas Fogaça Andrade', 'PCP', 'AUX. DE PCP'),
  ('Priscila Regina Rosa', 'EXTRUSÃO', 'APONTADOR(A) DE PRODUÇÃO'),
  ('Raul Felipe Araujo Ribeiro', 'EXTRUSÃO', 'REVISOR DE EXTRUSÃO PL.'),
  ('Regina Benedita Julio', 'SERVIÇOS GERAIS', 'AUX. DE LIMPEZA'),
  ('Rian Santos Rodrigues', 'REVISÃO', 'AUX. DE REVISÃO JR.'),
  ('Richard Augusto Rodrigues Dos Santos', 'LOGÍSTICA', 'AUX. DE EXPEDIÇÃO'),
  ('Rodrigo Cristiano Costa Menezes', 'EXTRUSÃO', 'OP. DE EXTRUSÃO JR.'),
  ('Sandro De Souza Alves', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('Sineide Soares De Queiroz Rodrigues', 'PESAGEM', 'AUX. DE PESAGEM'),
  ('Thiago De Oliveira Santos', 'REVISÃO', 'AUX. DE REVISÃO'),
  ('Valdeci De Sousa Oliveira', 'EXTRUSÃO', 'AUX. DE EXTRUSÃO'),
  ('Valdenrique Borges Da Silva', 'EXTRUSÃO', 'SUP. DE EXTRUSÃO SR.'),
  ('Valter Nobrega', 'EXTRUSÃO', 'OP. DE EXTRUSÃO SR.'),
  ('Viviane Soares De Queiroz', 'SERVIÇOS GERAIS', 'AUX. DE LIMPEZA'),
  ('Wesley Abel Almeida Dos Santos', 'MANUTENÇÃO', 'MECÂNICO DE MAN. PL.')
) as x(nome, setor, cargo)
join unidades u on u.nome = 'ViniPlast'
join setores s on s.unidade_id = u.id and s.nome = x.setor
join cargos c on c.setor_id = s.id and c.nome = x.cargo;

-- 8. Colaboradores — unidade Vinitrade (43 pessoas)
-- CPF e telefone não vieram na planilha — ficam NULL, a preencher depois no cadastro.
insert into colaboradores (empresa_id, setor_id, cargo_id, nome, status)
select s.empresa_id, s.id, c.id, x.nome, 'ativo'
from (values
  ('Adauto Almeida Garcia', 'CONFECÇÃO', 'OP. DE MAQ. DE SOLDA SR.'),
  ('Afonso Da Silva', 'CONFECÇÃO', 'AUX. DE MÁQUINA SOLDA JR.'),
  ('Alex Sandro Cruz Dos Santos', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('Antony Domingues Da Silva', 'PCP', 'ANALISTA DE PCP PL.'),
  ('Bruna Adriana Da Silva', 'CONFECÇÃO', 'OP. DE MAQ. DE ILHÓSES JR.'),
  ('Cleonice Ferreira De Oliveira Melo', 'CONFECÇÃO', 'COSTUREIRO (A) JUNIOR'),
  ('Cleusa Gonçalves', 'CONFECÇÃO', 'OP. DE MAQ. DE SOLDA JR.'),
  ('Daniele Aparecida Moreira Araujo Dos Santos', 'CONFECÇÃO', 'OP. DE SUPORTE PRODUTIVO'),
  ('Daniele De Lima Balbino', 'CONFECÇÃO', 'COSTUREIRO (A) JUNIOR'),
  ('Danilo Roberto Ribeiro De Oliveira', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('Eliseu Felipe Chilelli', 'CONFECÇÃO', 'REVISOR DE CONFECÇÃO JR.'),
  ('Erik Anderson Rosa Reis', 'QUALIDADE', 'ASSISTENTE DE QUALIDADE'),
  ('Evelyn Shayene Campos De Oliveira Nogueira', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('Gabriela Cristina Paulo Rodrigues', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('Gleiciane Santos Torres', 'CONFECÇÃO', 'ASSIS. DE EXPEDIÇÃO'),
  ('Guilherme Moraes Dos Santos', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('Joana Darc Domingos De Lima', 'CONFECÇÃO', 'AUX. DE MAQ. DE ILHÓSES JR.'),
  ('Julio Cesar Bayao Saraiva', 'CONFECÇÃO', 'SUP. DE CONFECÇÃO JR.'),
  ('Larissa Cristina Ribeiro Da Silva', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('Lucas Fernando Costa Vaz Lima', 'CONFECÇÃO', 'AUX. DE REVISÃO'),
  ('Luciana Maria Lopes', 'CONFECÇÃO', 'COSTUREIRO (A) JUNIOR'),
  ('Luis Gustavo Sousa Ramos', 'VINITELA', 'AUX. DE PRODUÇÃO'),
  ('Marcia Rodrigues', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('Maria De Fatima Dos Santos', 'CONFECÇÃO', 'COSTUREIRA SR.'),
  ('Marisa Germano De Oliveira', 'CONFECÇÃO', 'COSTUREIRA JR.'),
  ('Matheus Henrique Prisco Da Silva', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('Nilson Aparecido Domingues', 'CONFECÇÃO', 'OP. DE CORTE JR.'),
  ('Paulo Darcio Macedo Matos', 'CONFECÇÃO', 'OP. DE MAQ. DE SOLDA SR.'),
  ('Rafael Oliveira Da Silva', 'CONFECÇÃO', 'OP. DE CORTE JR.'),
  ('Regimara Moraes Da Silva Albuquerque', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('Rhiguens Arthur Moraes Bosqui', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('Ricardo Henrique Heinz', 'CONFECÇÃO', 'OP. DE MAQ. DE SOLDA SR.'),
  ('Ricardo Pereira Rosa', 'CONFECÇÃO', 'ANAL. DE LOGISTICA JR.'),
  ('Rogerio Pereira Dos Santos', 'CONFECÇÃO', 'COORDENADOR DE CONFECÇÃO'),
  ('Thiago Guimaraes Gonçalves Nascimento', 'CONFECÇÃO', 'AUX. DE REVISÃO'),
  ('Thiago Jano Lima Cazalla', 'VINITELA', 'OP. DE MAQUINAS'),
  ('Valentim Penido De Castro', 'PORTARIA', 'PORTEIRO'),
  ('Valerio Condori', 'CONFECÇÃO', 'COSTUREIRO (A) JUNIOR'),
  ('Vanessa Aparecida Dias Soares', 'VINITELA', 'OP. DE MAQUINAS'),
  ('Veronica Aparecida Dos Santos Da Silva', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('Vinicius Gustavo Cruz Pereira', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO'),
  ('Viviane Coelho Chagas De Melo', 'CONFECÇÃO', 'OP. DE SILK SCREEN JR.'),
  ('Wesley Ricardo Souza Da Silva', 'CONFECÇÃO', 'AUX. DE CONFECÇÃO')
) as x(nome, setor, cargo)
join unidades u on u.nome = 'Vinitrade'
join setores s on s.unidade_id = u.id and s.nome = x.setor
join cargos c on c.setor_id = s.id and c.nome = x.cargo;

commit;

-- ============================================================
-- FIM — verifique os avisos no chat sobre CA pendente e itens
-- fora do PGR antes de considerar este dado 100% validado.
-- ============================================================