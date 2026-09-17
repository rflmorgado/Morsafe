function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

/**
 * Baixa a ficha de entrega de EPI a qualquer momento (sem depender do fluxo
 * de desligamento), para consultas e verificações pontuais.
 */
export function BaixarFichaButton({
  colaboradorId,
  colaboradorNome,
}: {
  colaboradorId: string;
  colaboradorNome: string;
}) {
  return (
    <a
      href={`/colaboradores/${colaboradorId}/ficha`}
      target="_blank"
      rel="noopener noreferrer"
      title="Baixar ficha de EPI"
      aria-label={`Baixar ficha de EPI de ${colaboradorNome}`}
      onClick={(e) => e.stopPropagation()}
      className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-brand-50 hover:text-brand-700"
    >
      <DownloadIcon />
    </a>
  );
}
