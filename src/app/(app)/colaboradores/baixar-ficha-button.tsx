"use client";

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
 * de desligamento), para consultas e verificações pontuais. `?download=1`
 * diz pra rota forçar o download de verdade (Content-Disposition:
 * attachment) em vez de abrir inline no navegador — mesmo parâmetro já
 * usado no fluxo de desligamento, ver desligar-colaborador-button.tsx e o
 * comentário no topo de ficha/route.ts. Faltava aqui: sem ele, este botão
 * fazia exatamente a mesma coisa que "Visualizar", só com um ícone
 * diferente.
 */
export function BaixarFichaButton({
  colaboradorId,
  colaboradorNome,
}: {
  colaboradorId: string;
  colaboradorNome: string;
}) {
  function baixar(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    e.stopPropagation();
    // Mesmo motivo do ?t= em visualizar-ficha-button.tsx: garante uma url
    // nova a cada clique, pra nenhuma camada de cache do navegador/aparelho
    // reabrir uma ficha antiga em vez de buscar a atual no servidor.
    window.open(
      `/colaboradores/${colaboradorId}/ficha?download=1&t=${Date.now()}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <a
      href={`/colaboradores/${colaboradorId}/ficha?download=1`}
      target="_blank"
      rel="noopener noreferrer"
      title="Baixar ficha de EPI"
      aria-label={`Baixar ficha de EPI de ${colaboradorNome}`}
      onClick={baixar}
      className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-brand-50 hover:text-brand-700"
    >
      <DownloadIcon />
    </a>
  );
}
