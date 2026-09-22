import Link from "next/link";

function HistoricoIcon() {
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
      <path d="M3 3v5h5" />
      <path d="M3.05 13a9 9 0 1 0 2.13-8.36L3 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

export function HistoricoUsuarioButton({
  usuarioId,
  usuarioNome,
}: {
  usuarioId: string;
  usuarioNome: string;
}) {
  return (
    <Link
      href={`/usuarios/${usuarioId}/historico`}
      title="Ver histórico de ações"
      aria-label={`Ver histórico de ações de ${usuarioNome}`}
      className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-brand-50 hover:text-brand-700"
    >
      <HistoricoIcon />
    </Link>
  );
}
