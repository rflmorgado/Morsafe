import { IconBadge } from "./icon-badge";

/**
 * Cabeçalho padrão das telas de listagem (Colaboradores, EPIs, Usuários,
 * Movimentações, Estações...) — título + uma linha de descrição. Existe só
 * pra garantir que toda tela tenha exatamente o mesmo tamanho de fonte,
 * espaçamento e cor aqui — antes cada página repetia essas duas tags à
 * mão, e qualquer ajuste (como este) tinha que ser feito tela por tela.
 *
 * `icon` é opcional (nenhuma tela existente quebra por não passar) — mesmo
 * bloco de ícone vibrante usado no Dashboard (ver icon-badge.tsx), pra dar
 * identidade visual à tela sem aumentar o texto. Primeiro uso: Colaboradores
 * (pedido do Rafael, 05/10/2026); outras telas entram uma de cada vez.
 */
export function PageHeader({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      {icon && <IconBadge icon={icon} size="md" />}
      <div>
        <h2 className="text-[21px] font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
