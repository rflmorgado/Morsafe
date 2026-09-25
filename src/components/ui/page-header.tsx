/**
 * Cabeçalho padrão das telas de listagem (Colaboradores, EPIs, Usuários,
 * Movimentações, Estações...) — título + uma linha de descrição. Existe só
 * pra garantir que toda tela tenha exatamente o mesmo tamanho de fonte,
 * espaçamento e cor aqui — antes cada página repetia essas duas tags à
 * mão, e qualquer ajuste (como este) tinha que ser feito tela por tela.
 */
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-[21px] font-bold tracking-tight text-foreground">
        {title}
      </h2>
      {description && (
        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary">
          {description}
        </p>
      )}
    </div>
  );
}
