@AGENTS.md

# Padrão de confiabilidade do MorSafe (regra permanente)

O MorSafe guarda dados de conformidade legal (entrega de EPI, NR-06) que uma
empresa cliente pode precisar apresentar numa fiscalização ou ação
trabalhista. Aqui, um bug silencioso ou uma perda de dado não é só um
inconveniente — é risco jurídico real para quem usa o sistema. Por isso,
ao mexer neste projeto (Claude ou qualquer outro desenvolvedor):

## Infraestrutura de confiabilidade já implementada

Cada conversa com o Claude começa sem acesso ao que foi feito — ou
decidido — em outras conversas. Então, antes de propor CONSTRUIR qualquer
peça nova de infraestrutura (checagem automática, alerta de erro, backup,
etc.) OU RETOMAR algo que o Rafael já decidiu deixar pra depois (ver seção
"Decisões já tomadas" abaixo), ler esta lista inteira E confirmar o estado
real no GitHub/Vercel/Supabase (ela pode estar desatualizada, ou parte do
trabalho pode ter sido feita numa conversa que não deixou rastro aqui).
Nunca assumir que algo não existe, ou que uma pausa foi esquecida, só por
não ter sido mencionado nesta conversa.

- **CI (checagem automática antes de ir pro ar)**: `.github/workflows/ci.yml`,
  neste repositório. Roda `next typegen` + `tsc` + `eslint` + `build` em todo
  push/PR pro `main`. Criado 26/10/2026.
- **Alerta de erro em produção (Sentry)**: JÁ ESTÁ ATIVO, de ponta a ponta.
  O código está implementado neste repositório (`src/instrumentation.ts`,
  `src/instrumentation-client.ts`, `src/sentry.server.config.ts`,
  `src/sentry.edge.config.ts`, `src/app/global-error.tsx`), existe uma
  organização "morsafe" criada em sentry.io com um projeto
  `javascript-nextjs`, e o DSN já está configurado como
  `NEXT_PUBLIC_SENTRY_DSN` no Vercel (Settings > Environment Variables),
  em "All Environments", desde 20/10/2026. Não falta nada pra isso
  funcionar. (Source maps pro Sentry mostrar a linha exata do código-fonte
  no stack trace, em vez do bundle minificado, ainda não estão
  configurados — `next.config.ts` não usa `withSentryConfig`. Isso é só
  uma melhoria de debug, não afeta se o alerta chega ou não.)
- **Backup diário do banco**: NÃO fica neste repositório. Vive num
  repositório GitHub separado e privado, `rflmorgado/morsafe-backups`, com
  seu próprio workflow (`backup.yml`) que roda todo dia às 06:00 UTC (03:00
  em SP) e salva um `pg_dump` do banco ali, usando o secret
  `SUPABASE_DATABASE_URL` (configurado NESSE outro repositório, não neste).
  Rodando com sucesso todo dia desde 13/10/2026, sem falha. Os arquivos de
  backup ficam em texto puro (sem criptografia) — a única proteção hoje é o
  repositório ser privado.

## Decisões já tomadas (não reabrir sem o Rafael pedir primeiro)

Diferente da lista acima (coisas já construídas), isto aqui é coisas que o
Rafael já avaliou e decidiu DEIXAR DE LADO por enquanto — não é bug, não é
trabalho esquecido, é escolha. Encontrar algo que parece "faltando" nessa
lista não é convite pra corrigir: é sinal pra avisar o Rafael que o item
está nesse estado por decisão dele, e só agir se ele pedir pra retomar.

- **Chat da Mora sem resposta automática por IA**: a env var
  `ANTHROPIC_API_KEY` NÃO está configurada no Vercel — DE PROPÓSITO, não é
  uma peça faltando. O Rafael já decidiu, antes de 27/10/2026, deixar a
  resposta automática da Mora via IA pra depois; por enquanto ela só
  precisa direcionar quem visita o site pro WhatsApp/e-mail, o que o
  código já faz certinho sem precisar de chave nenhuma:
  `src/app/api/mora/route.ts` devolve 503 com a mensagem "O chat está
  indisponível no momento. Fala com a gente pelo WhatsApp ou e-mail!"
  quando não acha a chave, e `src/components/mora/mora-widget.tsx` mostra
  os links de WhatsApp e e-mail fixos embaixo do campo de digitar, sempre,
  com ou sem resposta de IA (decisão de escopo de 20/10/2026, comentário no
  topo do próprio arquivo). Isso já foi perguntado e recusado mais de uma
  vez — NÃO propor configurar essa chave, criar/entrar numa organização na
  Claude Platform, nem comprar crédito, sem o Rafael pedir explicitamente
  pra ativar a resposta automática da Mora.

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
   registraria), o registro durável de "empresa X foi excluída, por quem,
   quando" não pode viver em `log_auditoria` — desde 19/10/2026, (c) grava
   esse registro numa tabela separada, `empresas_excluidas` (ver
   `morsafe-add-empresas-excluidas.sql`), como a ÚLTIMA coisa que faz,
   depois que a própria empresa já foi apagada: sem FK para `empresas`
   (de propósito — se tivesse, a própria exclusão apagaria a prova em
   cascata) e sem RLS (mesma decisão já tomada para `empresas`, só acesso
   via service role). Esse insert é best-effort: uma falha nele não
   desfaz nem reporta erro para o chamador, porque a exclusão em si já
   terminou com sucesso a essa altura. Antes de mexer nessa área,
   confirmar isso com uma busca no código (grep), não só de memória.

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

8. Desde 30/10/2026 (aviso da Supabase por e-mail, 21/10/2026), toda tabela
   NOVA criada no schema `public` deixou de ganhar acesso automático à Data
   API (supabase-js/PostgREST/GraphQL) — mesmo com RLS habilitado e
   policies corretas (regra 2 acima), sem um `grant` explícito a API
   responde "permission denied" antes mesmo de chegar na RLS. Tabelas já
   existentes antes dessa data não são afetadas (mantêm o acesso que já
   tinham — nenhuma ação necessária nelas). Por isso, toda migração que
   criar uma tabela nova a partir de agora precisa incluir os `grant`s na
   mesma migração, logo depois do `enable row level security` / das
   policies, nunca como passo separado:

```sql
   grant select on public.nome_da_tabela to anon;        -- só se a tabela
                                                            -- precisar ser
                                                            -- lida sem login
                                                            -- (ex: o mesmo
                                                            -- caso de
                                                            -- verificacoes_documento)
   grant select, insert, update, delete on public.nome_da_tabela to authenticated;
   grant select, insert, update, delete on public.nome_da_tabela to service_role;
```

   `grant` e policy de RLS são independentes e as duas são necessárias:
   sem `grant`, a API nega antes de chegar na RLS; com `grant` mas sem
   policy, a RLS nega depois (ou libera geral, se a tabela ficar sem RLS
   habilitada — daí a regra 2). Ajustar os verbos do `grant` (select /
   insert / update / delete) conforme o que aquele papel realmente precisa
   fazer, igual já se decide hoje pra cada policy.

9. Causa raiz da falha de 26/10/2026 ("Itens da entrega inválidos" no
   Registrar entrega, estourando pra cliente de verdade): o componente
   `registrar-entrega-button.tsx` foi reescrito e parou de mandar o campo
   `itens` (JSON) que `registrarEntrega()` em `actions.ts` continuava
   exigindo — um descompasso entre o lado cliente e o lado servidor de um
   MESMO fluxo, só que cada lado foi editado sem reler o outro. Os três
   comandos da regra 6 (`tsc`, `eslint`, `next build`) NÃO pegam esse tipo
   de erro, porque o contrato entre os dois lados viaja como nome de campo
   de FormData e string JSON — nada ali é tipo verificado pelo
   TypeScript. Passou batido até um cliente tentar registrar uma entrega
   de verdade e travar. Pra não repetir:
     a) Toda mudança que toque UM lado de um par cliente/Server Action
        (o `.tsx` que monta o FormData, ou a função em `actions.ts` /
        `*-actions.ts` na mesma pasta que o lê) exige reler o OUTRO lado
        inteiro antes de considerar a mudança pronta — nunca alterar um
        dos dois de memória, assumindo que o outro continua igual.
     b) Qualquer mudança nos fluxos de Registrar entrega, Registrar
        devolução, Registrar recusa, assinatura na estação ou login sobe
        como branch + Pull Request (no diálogo de commit do GitHub,
        escolher "Create a new branch for this commit and start a pull
        request", nunca "Commit directly to the main branch") — isso gera
        uma URL de preview própria no Vercel, separada da produção.
     c) Antes de mesclar esse PR na `main`, testar o fluxo de verdade
        naquela URL de preview — registrar uma entrega/devolução de
        teste (colaborador e EPI de teste, nunca um cliente real), nos
        dois modos de confirmação ("Assinar aqui" e "Coletar na
        estação") — não basta ler o código e confiar que está certo. Só
        depois de ver funcionar na prática é que o PR é mesclado; é isso
        que vai pro ar pros clientes reais.

Isso não elimina todo risco — nenhum sistema é livre de bug —, mas fecha as
três categorias de falha que já pegaram este projeto (falha silenciosa de
banco, erro de implantação, e descompasso silencioso entre cliente e
servidor) e vira prática padrão daqui pra frente, não só uma promessa
pontual.
