"use client";

function EyeIcon() {
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
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Abre a ficha de entrega de EPI em uma nova aba, a qualquer momento (sem
 * depender do fluxo de desligamento), para consultas e verificações
 * pontuais. A rota serve o PDF com "Content-Disposition: inline" (ver
 * ficha/route.ts), então o navegador exibe o documento em vez de forçar o
 * download — quem quiser guardar uma cópia baixa direto do visualizador.
 */
export function VisualizarFichaButton({
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
      title="Visualizar ficha de EPI"
      aria-label={`Visualizar ficha de EPI de ${colaboradorNome}`}
      onClick={(e) => e.stopPropagation()}
      className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-brand-50 hover:text-brand-700"
    >
      <EyeIcon />
    </a>
  );
}
