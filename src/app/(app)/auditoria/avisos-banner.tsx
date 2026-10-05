// Banner de erro técnico, compartilhado pelas 3 abas que chamam
// apurarAuditoriaRegistros (Visão geral, Colaboradores, EPIs) — mostra o
// `avisos` devolvido pela apuração quando alguma consulta ao banco falhou,
// em vez de deixar a aba simplesmente parecer "sem dados" (ver comentário
// em lib/data/auditoria-registros.ts, CLAUDE.md regra 1). A mensagem é a do
// próprio Postgres/Supabase — técnica de propósito, pra poder ser copiada e
// enviada de volta pra investigação, não pra um usuário final entender.
export function AvisosBanner({ avisos }: { avisos: string[] }) {
  if (avisos.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-danger-text/30 bg-danger-bg p-4">
      <p className="text-[12.5px] font-bold text-danger-text">
        Não foi possível carregar tudo dessa apuração
      </p>
      <p className="mt-1 text-[12px] text-danger-text/90">
        Os dados abaixo podem estar incompletos. Copie a(s) mensagem(ns)
        abaixo e envie pra investigação:
      </p>
      <ul className="mt-2 space-y-1">
        {avisos.map((aviso, i) => (
          <li
            key={i}
            className="rounded-lg bg-surface px-2.5 py-1.5 font-mono text-[11px] break-all text-danger-text"
          >
            {aviso}
          </li>
        ))}
      </ul>
    </div>
  );
}
