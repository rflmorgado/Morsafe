import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/data/current-user";
import { getUsuarioDaEmpresa } from "@/lib/data/usuarios";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listLogsPorUsuario,
  descreverLogAuditoria,
  ACAO_LABEL,
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
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
  let logs: Awaited<ReturnType<typeof listLogsPorUsuario>> = [];
  let erroConfiguracao = false;
  try {
    const admin = createAdminClient();
    [alvo, logs] = await Promise.all([
      getUsuarioDaEmpresa(id, user.empresaId),
      listLogsPorUsuario(admin, id),
    ]);
  } catch (e) {
    console.error("HistoricoUsuarioPage:", e);
    erroConfiguracao = true;
  }

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

  if (!alvo) notFound();

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
                className="flex gap-3.5 border-b border-border-subtle py-3 last:border-b-0"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    DOT_CLASS[log.acao] ?? "bg-text-muted"
                  }`}
                />
                <div>
                  <div className="text-[13.5px] font-semibold text-foreground">
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
    </div>
  );
}
