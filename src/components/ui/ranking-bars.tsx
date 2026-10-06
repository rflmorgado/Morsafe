export type RankingItem = {
  label: string;
  value: number;
  sublabel?: string;
};

const ALTURA_BARRA_PX = 10;

/**
 * Lista de classificação (ranking) em barras horizontais — ex.: "Setor com
 * maior consumo" da tela de Relatórios. Cada barra é proporcional ao MAIOR
 * valor da própria lista (igual ao BarTrendChart), uma única cor (não é
 * identidade categórica, é magnitude — por isso uma cor só, sem precisar de
 * legenda, ver skill de dataviz: "sequencial = uma cor, nunca um arco-íris").
 *
 * O rótulo (nome do setor) fica ACIMA da barra, não dentro dela — nomes de
 * setor variam muito de tamanho e um rótulo dentro da barra ou vaza ou fica
 * cortado quando o valor é baixo. O valor fica à direita do rótulo, sempre
 * visível por fora da barra.
 *
 * Itens que não cabem em `maxItems` somam numa linha final "+ N outro(s)" em
 * vez de aparecerem todos — mesmo padrão de "Outros" dos donuts (nunca deixa
 * a lista crescer sem limite).
 */
export function RankingBars({
  items,
  formatValue,
  maxItems = 8,
}: {
  items: RankingItem[];
  formatValue: (value: number) => string;
  maxItems?: number;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Nenhum dado no período.</p>;
  }

  const visiveis = items.slice(0, maxItems);
  const restantes = items.slice(maxItems);
  const maximo = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="space-y-3">
      {visiveis.map((item, i) => {
        const largura = Math.max(2, Math.round((item.value / maximo) * 100));
        return (
          <div key={`${item.label}-${i}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-baseline gap-1.5 text-[12.5px]">
                <span className="shrink-0 font-semibold text-text-muted">
                  {i + 1}.
                </span>
                <span className="truncate font-semibold text-foreground">
                  {item.label}
                </span>
                {item.sublabel && (
                  <span className="shrink-0 text-text-muted">
                    · {item.sublabel}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-foreground">
                {formatValue(item.value)}
              </span>
            </div>
            <div
              className="w-full rounded-full bg-surface-muted"
              style={{ height: `${ALTURA_BARRA_PX}px` }}
            >
              <div
                style={{ width: `${largura}%`, height: `${ALTURA_BARRA_PX}px` }}
                className="rounded-full bg-brand-600"
              />
            </div>
          </div>
        );
      })}

      {restantes.length > 0 && (
        <p className="pt-1 text-[12px] text-text-muted">
          + {restantes.length} outro{restantes.length === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
