import Link from "next/link";
import { getCurrentUser } from "@/lib/data/current-user";
import { getUsuarioDaEmpresa } from "@/lib/data/usuarios";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listLogsPorUsuario,
  descreverLogAuditoria,
  ACAO_LABEL,
  HISTORICO_PAGE_SIZE,
} from "@/lib/data/log-auditoria";

const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin",
  encarregado: "Encarregado",
  leitura: "Leitura",
};

const DOT_CLASS: Record<string, string> = {
  criado: "bg-brand-600",
  atualizado: "bg-text-muted",
  desligado: "bg-danger-text",
  desativado: "bg-danger-text",
  reativado: "bg-brand-600",
  excluido: "bg-danger-text",
  papel_alterado: "bg-warning-text",
  importado: "bg-text-muted",
  exportado: "bg-text-muted",
  baixou_ficha: "bg-text-muted",
  login: "bg-brand-300",
  logout: "bg-text-muted",
};

// O banco grava `criado_em` em UTC (timestamptz). Sem o `timeZone` abaixo,
// o servidor formata usando o fuso dele — na Vercel isso é UTC, então os
// horários apareciam 3h à frente do horário de Brasília. Fixando o fuso
// aqui, o horário exibido bate com o horário local de quem fez a ação,
// independente de onde o servidor está rodando.
function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Mesma regra de acesso da tela /usuarios: exclusiva do admin da própria
// empresa. A tela de histórico é ainda mais sensível que a lista (mostra
// tudo que a pessoa já fez no sistema), então não relaxa essa checagem.
export default async function HistoricoUsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const user = await getCurrentUser();

  if (!user || user.papel !== "admin" || !user.empresaId) {
    return (
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Acesso restrito
        </h2>
        <p className="text-[13px] text-text-secondary">
          Esta página é exclusiva do administrador da empresa.
        </p>
      </div>
    );
  }

  let alvo: Awaited<ReturnType<typeof getUsuarioDaEmpresa>> = null;
  let logs: Awaited<ReturnType<typeof listLogsPorUsuario>>["logs"] = [];
  let total = 0;
  let erroConfiguracao = false;
  try {
    const admin = createAdminClient();
    const [alvoResult, logsResult] = await Promise.all([
      getUsuarioDaEmpresa(id, user.empresaId),
      listLogsPorUsuario(admin, id, { page }),
    ]);
    alvo = alvoResult;
    logs = logsResult.logs;
    total = logsResult.total;
  } catch (e) {
    console.error("HistoricoUsuarioPage:", e);
    erroConfiguracao = true;
  }

  const totalPages = Math.max(1, Math.ceil(total / HISTORICO_PAGE_SIZE));

  if (erroConfiguracao) {
    return (
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Histórico
        </h2>
        <p className="mt-4 max-w-md rounded-lg bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger-text">
          Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY
          ausente no Vercel). Adicione essa variável de ambiente em
          Settings &gt; Environment Variables e faça um novo deploy.
        </p>
      </div>
    );
  }

  // Antes disparava notFound(), que — sem um not-found.tsx próprio nesta
  // rota — cai na página 404 genérica e sem marca do Next.js, quebrando a
  // navegação (a pessoa fica sem saída visível de volta pro app). Em vez
  // disso, mostra um estado de erro no mesmo padrão visual das outras
  // checagens desta página (acesso restrito / config incompleta), sempre
  // com o caminho de volta pra Usuários. O log abaixo registra o motivo
  // exato (usuário não existe vs. pertence a outra empresa) pra diagnosticar
  // se isso se repetir.
  if (!alvo) {
    console.error(
      `HistoricoUsuarioPage: usuário não encontrado (id=${id}, empresaId=${user.empresaId})`,
    );
    return (
      <div className="space-y-1">
        <Link
          href="/usuarios"
          className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:underline"
        >
          ← Usuários
        </Link>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Usuário não encontrado
        </h2>
        <p className="max-w-md text-[13px] text-text-secondary">
          Este usuário não existe mais ou não pertence à sua empresa. Ele pode
          ter sido excluído definitivamente — nesse caso, o histórico de
          ações dele deixa de ficar disponível.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Link
        href="/usuarios"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:underline"
      >
        ← Usuários
      </Link>

      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Histórico de ações
      </h2>
      <p className="mb-5 text-[13px] text-text-secondary">
        Tudo que esta pessoa fez dentro do MorSafe, mais recente primeiro —
        pra rastreabilidade e conformidade.
      </p>

      <div className="overflow-hidden rounded-[14px] border border-border-subtle bg-surface">
        <div
          className="flex items-center gap-3.5 px-6 py-5"
          style={{ background: "var(--brand-900)" }}
        >
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-brand-600 text-[17px] font-bold text-white">
            {initials(alvo.nome)}
          </div>
          <div>
            <div className="text-[17px] font-bold text-white">
              {alvo.nome}
            </div>
            <div className="text-[12.5px] text-brand-100/70">
              {alvo.email} · {PAPEL_LABEL[alvo.papel] ?? alvo.papel}
            </div>
          </div>
          <span
            className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              alvo.ativo
                ? "bg-brand-100 text-brand-700"
                : "bg-danger-bg text-danger-text"
            }`}
          >
            {alvo.ativo ? "Ativo" : "Inativo"}
          </span>
        </div>

        <div className="px-6 py-5">
          {logs.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nenhuma ação registrada ainda.
            </p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex gap-3 border-b border-border-subtle py-2.5 last:border-b-0"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    DOT_CLASS[log.acao] ?? "bg-text-muted"
                  }`}
                />
                <div>
                  <div className="text-[13px] font-semibold text-foreground">
                    {ACAO_LABEL[log.acao] ?? log.acao}
                  </div>
                  <div className="mt-0.5 text-xs text-text-secondary">
                    {formatDateTime(log.criadoEm)} · {descreverLogAuditoria(log)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="text-[12.5px] text-text-secondary">
            Página {page} de {totalPages} · {total} ação
            {total === 1 ? "" : "ões"}
          </span>
          <div className="flex gap-2">
            <Link
              href={`/usuarios/${id}/historico${page - 1 > 1 ? `?page=${page - 1}` : ""}`}
              aria-disabled={page <= 1}
              tabIndex={page <= 1 ? -1 : undefined}
              className={`rounded-lg border border-border-strong px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition ${
                page <= 1
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-surface-muted"
              }`}
            >
              ← Anterior
            </Link>
            <Link
              href={`/usuarios/${id}/historico?page=${page + 1}`}
              aria-disabled={page >= totalPages}
              tabIndex={page >= totalPages ? -1 : undefined}
              className={`rounded-lg border border-border-strong px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition ${
                page >= totalPages
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-surface-muted"
              }`}
            >
              Próxima →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
