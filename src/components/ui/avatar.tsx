// Paleta categórica (ver globals.css --chart-cat-1..5) — a mesma usada no
// donut "Gasto por setor" do Dashboard, já validada contra daltonismo e
// contra o fundo do Card nos dois temas (claro/escuro). Reaproveitada aqui
// porque o avatar é exatamente "identidade" (uma cor por colaborador), o
// mesmo propósito pra que essa paleta foi pensada — nunca uma cor de status
// (verde/âmbar/vermelho de bom/alerta/crítico), pra não confundir "é a
// Maria" com "está pendente"/"crítico".
const CORES = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
];

function corPara(semente: string) {
  let hash = 0;
  for (let i = 0; i < semente.length; i++) {
    hash = (hash * 31 + semente.charCodeAt(i)) >>> 0;
  }
  return CORES[hash % CORES.length];
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

const SIZE = {
  // "xs" existe só pra tabela densa (Colaboradores, telas largas) — cada
  // pixel de coluna conta quando a linha tem 6 colunas + ícones de ação.
  // Nos cartões (telas estreitas, com uma linha só por colaborador) tem
  // espaço de sobra, aí usa "sm" normalmente.
  xs: "h-6 w-6 text-[9px]",
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-[12px]",
} as const;

/**
 * Avatar com iniciais — o "rostinho" ao lado do nome que o Rafael pediu
 * (05/10/2026) pra lista de Colaboradores. Como colaborador não tem foto
 * cadastrada no sistema, a cor de fundo é determinística a partir do nome
 * (sempre a mesma cor pro mesmo colaborador, sem precisar guardar nada novo
 * no banco) — identidade visual por pessoa, não um ícone genérico repetido
 * em toda linha, que seria o mesmo problema de "tela sem vida" de novo.
 */
export function Avatar({
  nome,
  size = "md",
}: {
  nome: string;
  size?: keyof typeof SIZE;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${SIZE[size]}`}
      style={{ backgroundColor: corPara(nome) }}
      aria-hidden
    >
      {iniciais(nome)}
    </span>
  );
}
