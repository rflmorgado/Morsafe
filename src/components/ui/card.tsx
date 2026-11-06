// "brand": variante com fundo levemente tingido na cor da marca
// (--brand-50/--brand-200, já com override pro tema escuro em globals.css),
// em vez do branco/superfície padrão — pedido do Rafael, 06/11/2026,
// comparando com plataformas de referência onde nem todo card é branco
// igual: um ou dois cards com um tom de fundo diferente criam ritmo visual
// na tela, em vez de tudo igual. Usada só em cards sem gráfico/dado cujo
// contraste já foi validado contra --surface (ver comentário da paleta
// categórica em globals.css) — ex.: o card de saudação do Dashboard — nunca
// nos cards que têm DonutChart/BarTrendChart, pra não invalidar essa
// checagem sem rodar o validador de novo.
const TONE = {
  plain: "border-border-subtle bg-surface",
  brand: "border-brand-200 bg-brand-50",
} as const;

export function Card({
  children,
  className = "",
  tone = "plain",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: keyof typeof TONE;
}) {
  return (
    <div
      className={`rounded-2xl border p-[18px] shadow-card ${TONE[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
