/**
 * Linha(s) de controles logo abaixo do PageHeader — busca/filtros numa
 * linha, ações (exportar, importar, "+ Novo...") noutra, sempre à direita.
 * Antes cada tela empilhava os dois grupos em duas linhas de um jeito
 * improvisado (classes diferentes em cada página), e o grupo de botões
 * ficava "solto", alinhado de um jeito que não conversava com a linha de
 * busca acima — daí a sensação de bagunça.
 *
 * A regra aqui é simples e propositalmente sem mágica: filtros SEMPRE
 * formam seu próprio grupo, numa linha só dele — os campos que quebrarem
 * por falta de espaço quebram dentro dessa linha, entre irmãos da mesma
 * "linha de pensamento" (busca, setor, status, período), nunca ficam soltos
 * ao lado de um botão de ação. Ações SEMPRE formam outro grupo, também só
 * dele, alinhado à direita. Uma tentativa anterior tentava juntar os dois
 * grupos numa única linha quando "cabia" — mas em telas com muitos filtros
 * (ex.: Movimentações, com 4 campos) isso fazia o grupo de filtros
 * transbordar pra fora do card em vez de quebrar, ficando pior que o
 * problema original. Duas linhas fixas, cada uma com sua própria largura
 * cheia disponível pra quebrar internamente, é o que garante nunca
 * transbordar e nunca misturar os dois grupos.
 */
export function ListToolbar({
  filters,
  actions,
}: {
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  if (!filters) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {actions}
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">{filters}</div>
      {actions && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
