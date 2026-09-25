import { getCurrentUser } from "@/lib/data/current-user";
import { listEstacoesAssinatura } from "@/lib/data/estacoes-assinatura";
import { NovaEstacaoButton } from "./nova-estacao-button";
import { EstacaoRowActions } from "./estacao-row-actions";
import { AutoRefresh } from "./auto-refresh";
import { PageHeader } from "@/components/ui/page-header";
import { ListToolbar } from "@/components/ui/list-toolbar";

// Limiares de "aparelho visto por último" — a estação (ver src/app/estacao)
// consulta o servidor a cada poucos segundos enquanto a página estiver
// aberta, então esses limiares são bem mais curtos que os da bolinha de
// presença de usuário (ver statusPresenca em lib/data/usuarios.ts), que só
// atualiza a cada request de navegação.
const LIMIAR_ONLINE_MS = 15_000;
const LIMIAR_AUSENTE_MS = 2 * 60_000;

type StatusAparelho = "online" | "ausente" | "offline" | "nunca_conectou";

function statusAparelho(ultimoPing: string | null): StatusAparelho {
  if (!ultimoPing) return "nunca_conectou";
  const decorrido = Date.now() - new Date(ultimoPing).getTime();
  if (decorrido <= LIMIAR_ONLINE_MS) return "online";
  if (decorrido <= LIMIAR_AUSENTE_MS) return "ausente";
  return "offline";
}

const STATUS_DOT: Record<StatusAparelho, string> = {
  online: "bg-brand-500",
  ausente: "bg-warning-text",
  offline: "bg-danger-text",
  nunca_conectou: "bg-text-muted",
};

const STATUS_LABEL: Record<StatusAparelho, string> = {
  online: "Aparelho conectado agora",
  ausente: "Aparelho visto há pouco",
  offline: "Aparelho offline",
  nunca_conectou: "Aguardando pareamento",
};

// Só admin da própria empresa gerencia estações — mesmo nível de acesso da
// tela /usuarios, já que cadastrar/revogar um aparelho de coleta é uma
// decisão de infraestrutura da empresa, não uma tarefa do dia a dia do
// almoxarifado.
export default async function EstacoesPage() {
  const user = await getCurrentUser();

  if (!user || user.papel !== "admin" || !user.empresaId) {
    return (
      <div className="space-y-1">
        <PageHeader
          title="Acesso restrito"
          description="Esta página é exclusiva do administrador da empresa."
        />
      </div>
    );
  }

  const estacoes = await listEstacoesAssinatura();

  return (
    <div className="space-y-1">
      <AutoRefresh />
      <PageHeader
        title="Estações de assinatura"
        description="Aparelhos da própria empresa (tablet ou celular) fixados num ponto de coleta — o almoxarifado, por exemplo — pra coletar a assinatura do colaborador quando o registro é feito num computador sem tela touch. Nunca usa o celular pessoal do colaborador."
      />

      <ListToolbar actions={<NovaEstacaoButton />} />

      <div className="overflow-x-auto rounded-[14px] border border-border-subtle">
        <table className="w-full min-w-[560px] border-collapse bg-surface text-left">
          <thead>
            <tr>
              {["Nome", "Aparelho", "Status", ""].map((label) => (
                <th
                  key={label || "acoes"}
                  className="border-b border-border-subtle bg-brand-50 px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wide text-text-secondary"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {estacoes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-text-muted">
                  Nenhuma estação cadastrada ainda. Clique em &ldquo;+ Nova
                  estação&rdquo; pra gerar o primeiro QR de pareamento.
                </td>
              </tr>
            ) : (
              estacoes.map((e) => {
                const status = e.pareada
                  ? statusAparelho(e.ultimoPing)
                  : "nunca_conectou";
                return (
                  <tr
                    key={e.id}
                    className="border-b border-border-subtle last:border-b-0"
                  >
                    <td className="px-4 py-3.5 text-[13.5px] font-medium text-foreground">
                      {e.nome}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          e.pareada
                            ? "bg-brand-100 text-brand-700"
                            : "bg-warning-bg text-warning-text"
                        }`}
                      >
                        {e.pareada ? "Pareado" : "Sem aparelho pareado"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground"
                        title={STATUS_LABEL[status]}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`}
                        />
                        {e.ativo ? STATUS_LABEL[status] : "Desativada"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <EstacaoRowActions
                        estacaoId={e.id}
                        estacaoNome={e.nome}
                        ativa={e.ativo}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
