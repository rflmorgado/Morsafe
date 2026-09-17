/**
 * Logo oficial do MorSafe (escudo + capacete + check), aprovado no
 * protótipo. Arquivo em public/brand/shield.png.
 */
export function ShieldIcon({
  className,
  invert = false,
}: {
  className?: string;
  invert?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ícone pequeno, tamanho controlado por className em vários contextos
    <img
      src="/brand/shield.png"
      alt="MorSafe"
      className={`${className ?? ""} object-contain ${invert ? "brightness-0 invert" : ""}`}
    />
  );
}
