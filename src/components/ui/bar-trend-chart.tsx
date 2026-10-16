"use client";

import { useEffect, useRef } from "react";

export type BarPoint = {
  label: string;
  value: number;
};

const ALTURA_MAX_PX = 120;

/**
 * Gráfico de barras simples em HTML/CSS puro (sem SVG nem biblioteca) pra
 * tendência de poucos pontos — pensado pros 6 meses de "Entregas no mês" do
 * Dashboard. Altura de cada barra é proporcional ao MAIOR valor da própria
 * série (nunca a uma escala fixa): um histórico todo baixo (poucas entregas
 * em todos os meses) ainda aparece com barras visíveis, em vez de ficar
 * achatado perto do eixo.
 *
 * O mês mais recente vem em `bg-brand-500` (mesma cor do indicador "▲" do
 * KpiCard) pra marcar "isso é agora" entre os outros 5, em `bg-brand-600` —
 * as duas cores foram escolhidas (não só herdadas da escala de marca) por
 * manterem contraste >= 3:1 contra o Card nos dois temas (claro E escuro),
 * o que a maioria dos tons dessa escala não garante sozinha. O rótulo do
 * mês atual também vem em negrito — a diferença nunca depende só da cor.
 *
 * `formato`/`unidadeTooltip`: quando este gráfico passou a ser reusado
 * também pra "Gasto por mês" (Relatórios, 16/10/2026), o número cru em reais
 * (ex.: "15800", sem formatação) era mais largo que "8" ou "12" — quem usa o
 * gráfico pra dinheiro passa `formato="dinheiro"` pra já chegar formatado
 * ("R$ 15.800") em vez do número cru, e o rótulo ganhou `break-words`/
 * `text-center` pra quebrar linha em vez de estourar a coluna. É uma string
 * ("quantidade" | "dinheiro"), não a função de formatação em si — esse
 * componente é "use client" (ver comentário de rolagem logo abaixo), e um
 * Server Component (como relatorios/page.tsx) não pode passar uma função
 * (ex.: `formatValue={formatMoney}`) pra um Client Component: o React quebra
 * a página inteira em runtime com "Functions cannot be passed directly to
 * Client Components" — foi exatamente o erro que o Rafael viu em
 * /relatorios depois do deploy, 16/10/2026 (só nessa tela, porque só ela
 * passava uma função; o build local não pegou porque /relatorios é uma
 * rota dinâmica, renderizada só em request, não durante `next build`).
 * A formatação em si mora aqui dentro agora (`formatarValor`), não mais
 * recebida de fora.
 *
 * Rolagem horizontal (16/10/2026): a tela de Relatórios mostra 12 meses
 * (Dashboard mostra 6) — 12 colunas de largura mínima num Card de meia
 * largura da página não cabem de jeito nenhum, e sem rolagem a fileira
 * simplesmente vazava pra fora do Card e era cortada pela borda da tela
 * (print do Rafael, 16/10/2026: só "Nov/25" a "Mai/26" apareciam, o resto
 * sumia). Por isso o container agora rola (`overflow-x-auto`) e cada coluna
 * tem uma largura mínima (`min-w-[44px]`) em vez de só poder encolher sem
 * limite — com poucos meses (6, Dashboard) tudo continua cabendo e
 * esticando igual antes, sem barra de rolagem; com 12 (Relatórios), o que
 * não cabe fica visível rolando pro lado, nunca invisível cortado na borda.
 * O scroll já abre mostrando o FIM da lista (mês atual, a barra em
 * destaque) — "use client" por causa disso (useEffect/useRef) — em vez do
 * começo: sem isso o Rafael abriria a tela e veria 6 meses de 2025 parados
 * em R$ 0, com o mês atual escondido rolagem adentro.
 */
function formatarValor(value: number, formato: "quantidade" | "dinheiro") {
  if (formato === "quantidade") return String(value);
  // Mesmo ajuste de NBSP do formatMoney em dashboard/page.tsx e
  // relatorios/page.tsx: troca o espaço sem quebra por um espaço normal,
  // senão "R$ 15.800" vira um token só e não quebra linha no break-words.
  return value
    .toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    })
    .replace(/\u00a0/g, " ");
}

export function BarTrendChart({
  data,
  formato = "quantidade",
  unidadeTooltip = "entrega",
}: {
  data: BarPoint[];
  formato?: "quantidade" | "dinheiro";
  // Sufixo do tooltip (title) de cada barra, ex.: "entrega(s)". Passe ""
  // quando o valor já não for uma contagem de algo (ex.: dinheiro).
  unidadeTooltip?: string;
}) {
  const maximo = Math.max(1, ...data.map((d) => d.value));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mesma lista sempre tem o mês atual por último — abre a rolagem já lá.
  // Quando cabe tudo sem rolar, scrollLeft vira 0 de qualquer forma (não
  // tem o que rolar), então isso não afeta o caso de 6 meses do Dashboard.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data]);

  return (
    <div>
      <div ref={scrollRef} className="overflow-x-auto overscroll-x-contain">
        <div className="flex h-[160px] items-end gap-3 sm:gap-5">
          {data.map((d, i) => {
            const altura = Math.max(4, Math.round((d.value / maximo) * ALTURA_MAX_PX));
            const atual = i === data.length - 1;
            const valorFormatado = formatarValor(d.value, formato);
            return (
              <div
                key={`${d.label}-${i}`}
                className="flex min-w-[44px] flex-1 flex-col items-center gap-1.5"
              >
                <span className="break-words text-center text-[12px] font-bold tabular-nums text-foreground">
                  {valorFormatado}
                </span>
                <div
                  title={`${d.label}: ${valorFormatado}${
                    unidadeTooltip ? ` ${unidadeTooltip}${d.value === 1 ? "" : "s"}` : ""
                  }`}
                  style={{ height: `${altura}px` }}
                  className={`w-full rounded-t-md ${
                    atual ? "bg-brand-500" : "bg-brand-600"
                  }`}
                />
                <span
                  className={`text-[11px] ${
                    atual
                      ? "font-bold text-foreground"
                      : "font-semibold text-text-muted"
                  }`}
                >
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Dica só aparece quando a lista é grande o bastante pra provavelmente
          precisar de rolagem (o gatilho de 6 é o mesmo "tamanho pensado"
          citado no comentário acima) — em telas com poucos meses, que cabem
          inteiros, não faz sentido mostrar uma dica de rolar pro lado. */}
      {data.length > 6 && (
        <p className="mt-1.5 text-center text-[11px] text-text-muted">
          Arraste para o lado para ver os outros meses →
        </p>
      )}
    </div>
  );
}
