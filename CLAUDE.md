@AGENTS.md

# Padrão de confiabilidade do MorSafe (regra permanente)

O MorSafe guarda dados de conformidade legal (entrega de EPI, NR-06) que uma
empresa cliente pode precisar apresentar numa fiscalização ou ação
trabalhista. Aqui, um bug silencioso ou uma perda de dado não é só um
inconveniente — é risco jurídico real para quem usa o sistema. Por isso,
ao mexer neste projeto (Claude ou qualquer outro desenvolvedor):

1. Nunca confiar em `.update()` / `.insert()` / `.delete()` do Supabase só
   porque `error` veio `null`. Um `.update().eq(...)` que não bate com
   nenhuma linha retorna `error: null` mesmo sem alterar nada — já foi a
   causa raiz de dois bugs neste projeto (RLS habilitado sem nenhuma
   policy, em duas tabelas diferentes). Sempre que a operação for crítica,
   confirmar a contagem de linhas afetadas ou reconsultar o dado depois de
   escrever.

2. Toda tabela nova no Supabase exige uma decisão deliberada: RLS com
   policies de verdade, ou RLS desabilitado por design (documentando o
   motivo no SQL, como já é o padrão em `empresas` e
   `verificacoes_documento`). Nunca aceitar por reflexo o botão
   "Run and enable RLS" do editor — isso cria uma tabela protegida sem
   nenhuma policy, que bloqueia toda escrita silenciosamente.

3. Tabelas de histórico/auditoria (`entregas`, `devolucoes`, `recusas`,
   `log_auditoria`, `verificacoes_documento`) são imutáveis por design:
   nenhum caminho de código deve ter `.update()` ou `.delete()` nelas —
   com uma única exceção, estreita e deliberada: `resetarDadosEmpresa`
   (em `src/app/(app)/empresas/actions.ts`), acessível só pelo
   super_admin, usada para apagar dados de TESTE de uma empresa cliente
   durante onboarding/depuração — nunca dado real de produção, e sempre
   com o nome exato da empresa digitado como confirmação. Qualquer outro
   caminho de código que precise apagar algo nessas tabelas deve
   reaproveitar essa função, nunca duplicar um `.delete()` avulso em
   outro lugar. `log_auditoria` continua imutável mesmo aqui — o reset
   GRAVA uma linha nova nela (ação `dados_resetados`) contando que
   aconteceu, nunca apaga nenhuma linha existente. Antes de mexer nessa
   área, confirmar isso com uma busca no código (grep), não só de
   memória.

4. Funcionalidade acessória (ex: geração de QR code, código de
   verificação, logo da empresa) nunca pode travar a emissão do
   documento principal. Sempre com try/catch e fallback gracioso,
   registrando o erro no servidor sem quebrar a experiência de quem está
   usando.

5. Para qualquer coisa ligada a conformidade legal ou integridade de dado
   (hash, QR code, geração de PDF), preferir bibliotecas reais e
   amplamente usadas em vez de implementação própria — e testar de ponta
   a ponta (gerar → verificar/decodificar de volta), nunca só inspeção
   visual.

6. Nenhuma mudança é considerada pronta sem passar, sem erros, por:
   `npx tsc --noEmit`, `npx eslint` e um build de produção completo
   (`npx next build`). As três, sempre, antes de entregar.

7. Mudança de schema (nova coluna, nova tabela, alteração de tipo) nunca é
   destrutiva sem confirmação explícita — preferir sempre migração
   aditiva a algo que possa apagar dado já existente.

Isso não elimina todo risco — nenhum sistema é livre de bug —, mas fecha as
duas categorias de falha que já pegaram este projeto (falha silenciosa de
banco e erro de implantação) e vira prática padrão daqui pra frente, não só
uma promessa pontual.
