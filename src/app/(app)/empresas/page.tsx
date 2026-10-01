import Link from "next/link";
import { getCurrentUser } from "@/lib/data/current-user";
import { listEmpresasComResumo, statusLimiteColaboradores } from "@/lib/data/empresas";
import { PageHeader } from "@/components/ui/page-header";
import { ListToolbar } from "@/components/ui/list-toolbar";

// `criado_em` é gravado em UTC (timestamptz) — sem o `timeZone` abaixo, a
// formatação usaria o fuso do processo Node (UTC na Vercel), mostrando uma
// data um dia adiantada perto da virada. Mesmo bug já corrigido em várias
// outras telas (ver estoque/page.tsx).
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Painel do super_admin: todas as empresas clientes do MorSafe, com um
 * resumo rápido de cada uma. Página inicial de quem administra o sistema —
 * diferente do Dashboard operacional (que não faz sentido pra quem não
 * pertence a nenhuma empresa). Clicar numa empresa leva ao detalhe dela
 * (ver [id]/page.tsx) — por enquanto só leitura (dados, resumo e usuários);
 * ações administrativas (ativar/desativar, reset de dados) ficam pra uma
 * próxima etapa, combinada à parte.
 */
export default async function EmpresasPage() {
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

  const empresas = await listEmpresasComResumo();

  return (
    <div>
      <PageHeader
        title="Empresas cadastradas"
        description="Todas as empresas clientes do MorSafe e um resumo de cada uma."
      />

      <ListToolbar
        actions={
          <Link
            href="/setup-empresa"
            className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
          >
            + Nova empresa
          </Link>
        }
      />

      {empresas.length === 0 ? (
        <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
          Nenhuma empresa cadastrada ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                  Empresa
                </th>
                <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                  CNPJ
                </th>
                <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                  Status
                </th>
                <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                  Colaboradores
                </th>
                <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                  EPIs
                </th>
                <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                  Usuários
                </th>
                <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                  Criada em
                </th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border-subtle last:border-b-0 hover:bg-surface-muted"
                >
                  <td className="px-4 py-3 text-[13.5px] font-medium text-foreground">
                    <Link
                      href={`/empresas/${e.id}`}
                      className="hover:text-brand-700 hover:underline"
                    >
                      {e.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-text-secondary">
                    {e.cnpj || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
                        e.ativo
                          ? "bg-brand-50 text-brand-700"
                          : "bg-danger-bg text-danger-text"
                      }`}
                    >
                      {e.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-foreground">
                    <div className="flex items-center gap-2">
                      <span>
                        {e.totalColaboradores}
                        {e.limiteColaboradores !== null && (
                          <span className="text-text-muted">
                            {" "}
                            / {e.limiteColaboradores}
                          </span>
                        )}
                      </span>
                      {(() => {
                        const badge = statusLimiteColaboradores(
                          e.totalColaboradores,
                          e.limiteColaboradores,
                        );
                        return badge ? (
                          <span
                            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${badge.classe}`}
                          >
                            {badge.texto}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-foreground">
                    {e.totalEpis}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-foreground">
                    {e.totalUsuarios}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-text-secondary">
                    {formatDate(e.criadoEm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
