const TONE = {
  brand: {
    bg: "bg-brand-500",
    shadow: "shadow-[0_6px_16px_-6px_rgba(52,160,94,0.55)]",
  },
  warn: {
    bg: "bg-warning-text",
    shadow: "shadow-[0_6px_16px_-6px_rgba(138,90,0,0.45)]",
  },
  danger: {
    bg: "bg-danger-text",
    shadow: "shadow-[0_6px_16px_-6px_rgba(179,38,30,0.45)]",
  },
} as const;

const SIZE = {
  sm: "h-7 w-7 rounded-lg",
  md: "h-11 w-11 rounded-2xl",
} as const;

/**
 * Bloco de ícone sólido e colorido (branco sobre a cor, com um leve brilho —
 * box-shadow na própria cor — por baixo), em vez do chip bem clarinho usado
 * antes (bg-brand-100/text-brand-700). Pedido do Rafael, 05/10/2026: o app
 * estava "sem vida" perto de peças de marketing com ícone vibrante em bloco
 * colorido — aqui o ganho vem da cor/forma do ícone, nunca do tamanho da
 * fonte (ele foi explícito: nada de letra gigante, o app roda no celular).
 *
 * Primeiro uso: KpiCard (tamanho "md") e os títulos de card do Dashboard
 * (tamanho "sm") — pensado pra ser reaproveitado nas próximas telas
 * (Colaboradores, EPIs etc.) com o mesmo visual, em vez de cada tela
 * inventar seu próprio chip.
 */
export function IconBadge({
  icon,
  tone = "brand",
  size = "md",
}: {
  icon: React.ReactNode;
  tone?: keyof typeof TONE;
  size?: keyof typeof SIZE;
}) {
  const t = TONE[tone];
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden text-white ${SIZE[size]} ${t.bg} ${t.shadow}`}
    >
      {/* Mesmo verniz sutil do botão primário (.bg-brand-700 em
          globals.css) — luz batendo de cima, pra não ficar "tinta
          chapada" numa cor sólida. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent"
      />
      <span className="relative flex items-center justify-center">
        {icon}
      </span>
    </span>
  );
}
