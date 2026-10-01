import Link from "next/link";
import { getCurrentUser } from "@/lib/data/current-user";
import { getEmpresaComResumo } from "@/lib/data/empresas";
import { listUsuariosDaEmpresa } from "@/lib/data/usuarios";
import { PageHeader } from "@/components/ui/page-header";

const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin",
  encarregado: "Encarregado",
  leitura: "Leitura",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Detalhe de uma empresa cliente, visto pelo super_admin — ainda só
 * leitura (dados cadastrais, resumo operacional e os logins da empresa).
 * Ações administrativas (ativar/desativar, reset de dados) ficam pra uma
 * próxima etapa, combinada à parte — ver conversa sobre a regra 3 do
 * CLAUDE.md antes de adicionar qualquer ação que apague dado aqui.
 */
export default async function EmpresaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user || user.papel !== "super_admin") {
    return (
      <div className="space-y-1">
        <PageHeader
          title="Acesso restrito"
          description="Esta página é exclusiva do super_admin."
        />
      </div>
    );
  }

  const empresa = await getEmpresaComResumo(id);

  if (!empresa) {
    return (
      <div className="space-y-1">
        <PageHeader
          title="Empresa não encontrada"
          description="Verifique o link ou volte para a lista de empresas."
        />
        <Link
          href="/empresas"
          className="text-[13px] font-medium text-brand-700 hover:underline"
        >
          ← Voltar para Empresas
        </Link>
      </div>
    );
  }

  const usuarios = await listUsuariosDaEmpresa(empresa.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/empresas"
          className="mb-2 inline-block text-[12.5px] font-medium text-text-muted hover:text-text-secondary"
        >
          ← Empresas
        </Link>
        <PageHeader
          title={empresa.nome}
          description={empresa.cnpj ? `CNPJ ${empresa.cnpj}` : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Status", valor: empresa.ativo ? "Ativa" : "Inativa" },
          { label: "Colaboradores", valor: empresa.totalColaboradores },
          { label: "EPIs homologados", valor: empresa.totalEpis },
          { label: "Usuários", valor: empresa.totalUsuarios },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border-subtle bg-surface p-4 shadow-card"
          >
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">
              {item.label}
            </p>
            <p className="mt-1 text-[19px] font-bold text-foreground">
              {item.valor}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[12.5px] text-text-muted">
        Cadastrada em {formatDate(empresa.criadoEm)}
      </p>

      <div>
        <h3 className="mb-3 text-[15px] font-bold tracking-tight text-foreground">
          Usuários
        </h3>
        {usuarios.length === 0 ? (
          <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
            Nenhum usuário cadastrado nesta empresa.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
            <table className="w-full min-w-[480px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                    E-mail
                  </th>
                  <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                    Papel
                  </th>
                  <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border-subtle last:border-b-0"
                  >
                    <td className="px-4 py-3 text-[13.5px] font-medium text-foreground">
                      {u.nome}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-text-secondary">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-text-secondary">
                      {PAPEL_LABEL[u.papel] ?? u.papel}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
                          u.ativo
                            ? "bg-brand-50 text-brand-700"
                            : "bg-danger-bg text-danger-text"
                        }`}
                      >
                        {u.ativo ? "Ativo" : "Desativado"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
