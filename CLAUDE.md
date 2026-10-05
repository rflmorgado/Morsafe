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
   com três exceções, estreitas e deliberadas, todas só super_admin e
   todas exigindo digitar um texto exato como confirmação:
     a) `resetarDadosEmpresa` (em `src/app/(app)/empresas/actions.ts`),
        usada para apagar TODOS os dados de TESTE de uma empresa cliente
        inteira durante onboarding/depuração — nunca dado real de
        produção. Confirmação: nome exato da empresa.
     b) `excluirEntregaTeste` (em
        `src/app/(app)/movimentacoes/actions.ts`), usada para apagar UMA
        entrega específica lançada por engano como teste sobre um
        colaborador que já tem dado real (cenário em que rodar (a)
        destruiria tudo). Confirmação: nome exato do colaborador. Recusa
        se já existir devolução vinculada, e repõe `estoque.saldo_atual`
        manualmente antes de apagar (único lugar do app que escreve
        direto nessa coluna — ver comentário na função).
     c) `excluirEmpresaPermanentemente` (em
        `src/app/(app)/empresas/actions.ts`), a mais larga das três: apaga
        uma empresa cliente inteira — logins (usuarios + o auth.users de
        cada um), estrutura (unidades/setores/cargos), colaboradores,
        EPIs, estoque e TODO o histórico, inclusive `log_auditoria`
        daquela empresa. Diferente de (a) e (b), aqui `log_auditoria` NÃO
        é preservado — não tem como preservar o histórico de uma empresa
        que deixou de existir, e tecnicamente não dá: `log_auditoria.
        usuario` referencia `usuarios(id)` com FK restrict, então precisa
        sair antes de `usuarios`, que por sua vez precisa sair antes de
        `empresas` (também restrict). Só funciona com a empresa já
        desativada antes (mesma trava de `excluirUsuarioDefinitivamente`
        em `usuarios/actions.ts`). Confirmação: nome exato da empresa.
        Usada só para remover de vez um cliente que saiu do MorSafe —
        nunca para limpar dado de teste (isso é (a)) nem para corrigir um
        lançamento (isso é (b)).
   Qualquer outro caminho de código que precise apagar algo nessas
   tabelas deve reaproveitar uma destas três, nunca duplicar um
   `.delete()` avulso em outro lugar. `log_auditoria` continua imutável
   em (a) e (b) — as duas GRAVAM uma linha nova nela (`dados_resetados` /
   `entrega_teste_excluida`) contando o que aconteceu, nunca apagam
   nenhuma linha existente; (c) é a exceção à exceção, pelo motivo acima.
   Como (c) apaga a própria empresa (e com ela todo `log_auditoria` que a
   registraria), não existe hoje nenhum registro durável no banco de
   "empresa X foi excluída, por quem, quando" — fica só no log do
   servidor (Vercel), uma limitação aceita enquanto o acesso ao painel do
   Supabase estiver bloqueado (sem como criar uma tabela nova só para
   isso agora; revisitar quando o acesso voltar). Antes de mexer nessa
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
