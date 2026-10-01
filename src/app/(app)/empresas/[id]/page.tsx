import Link from "next/link";
import { getCurrentUser } from "@/lib/data/current-user";
import { getEmpresaComResumo, statusLimiteColaboradores } from "@/lib/data/empresas";
import { listUsuariosDaEmpresa } from "@/lib/data/usuarios";
import { listPagamentosDaEmpresa, formatStatusPagamento } from "@/lib/data/pagamentos";
import { PageHeader } from "@/components/ui/page-header";
import { AlternarAtivoButton } from "../ativar-empresa-button";
import { ResetarEmpresaButton } from "../resetar-empresa-button";
import { DefinirLimiteButton } from "../definir-limite-button";
import { NovoPagamentoButton } from "../../pagamentos/novo-pagamento-button";
import { MarcarPagoButton } from "../../pagamentos/marcar-pago-button";

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

// `data_vencimento`/`data_pagamento` são `date` puro — mesmo motivo do
// "T00:00:00" já usado em app/(app)/pagamentos/page.tsx (evita a data
// aparecer um dia a menos no fuso do Brasil).
function formatDateSemHora(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Detalhe de uma empresa cliente, visto pelo super_admin: dados
 * cadastrais, resumo operacional, os logins da empresa e as ações
 * administrativas (ativar/desativar acesso, resetar dados de teste — ver
 * actions.ts e a exceção documentada na regra 3 do CLAUDE.md).
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
  const pagamentos = await listPagamentosDaEmpresa(empresa.id, empresa.nome);

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
        <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-card">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">
            Status
          </p>
          <p className="mt-1 text-[19px] font-bold text-foreground">
            {empresa.ativo ? "Ativa" : "Inativa"}
          </p>
        </div>

        {/* Colaboradores é um card à parte (não um map genérico como os
            outros) porque, diferente dos demais números, mostra o limite do
            plano ao lado (quando definido) e um selo de alerta — ver
            statusLimiteColaboradores em lib/data/empresas.ts. */}
        <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-card">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">
            Colaboradores
          </p>
          <p className="mt-1 text-[19px] font-bold text-foreground">
            {empresa.totalColaboradores}
            {empresa.limiteColaboradores !== null && (
              <span className="text-text-muted">
                {" "}
                / {empresa.limiteColaboradores}
              </span>
            )}
          </p>
          {(() => {
            const badge = statusLimiteColaboradores(
              empresa.totalColaboradores,
              empresa.limiteColaboradores,
            );
            return badge ? (
              <span
                className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${badge.classe}`}
              >
                {badge.texto}
              </span>
            ) : null;
          })()}
        </div>

        {[
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

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-bold tracking-tight text-foreground">
            Pagamentos
          </h3>
          <NovoPagamentoButton empresaIdFixo={empresa.id} />
        </div>
        {pagamentos.length === 0 ? (
          <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
            Nenhum pagamento registrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
            <table className="w-full min-w-[480px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                    Vencimento
                  </th>
                  <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[12.5px] font-semibold text-text-secondary">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((p) => {
                  const status = formatStatusPagamento(p.statusComputado);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border-subtle last:border-b-0"
                    >
                      <td className="px-4 py-3 text-[13.5px] font-medium text-foreground">
                        {formatMoney(p.valor)}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-secondary">
                        {formatDateSemHora(p.dataVencimento)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${status.classe}`}
                        >
                          {status.texto}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === "pendente" ? (
                          <MarcarPagoButton
                            pagamentoId={p.id}
                            empresaNome={p.empresaNome}
                          />
                        ) : (
                          <span className="text-[12.5px] text-text-muted">
                            {p.dataPagamento
                              ? `Pago em ${formatDateSemHora(p.dataPagamento)}`
                              : "Pago"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-[15px] font-bold tracking-tight text-foreground">
          Ações administrativas
        </h3>
        <div className="flex flex-wrap gap-3 rounded-2xl border border-border-subtle bg-surface p-5 shadow-card">
          <AlternarAtivoButton
            empresaId={empresa.id}
            empresaNome={empresa.nome}
            ativo={empresa.ativo}
          />
          <ResetarEmpresaButton
            empresaId={empresa.id}
            empresaNome={empresa.nome}
          />
          <DefinirLimiteButton
            empresaId={empresa.id}
            limiteAtual={empresa.limiteColaboradores}
          />
        </div>
      </div>
    </div>
  );
}
