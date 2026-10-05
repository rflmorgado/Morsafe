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

// Ícone vibrante do cabeçalho (mesmo tratamento de Dashboard/Colaboradores/
// EPIs/Movimentações) — um tablet com uma linha de assinatura embaixo,
// resumindo o que a tela faz: cadastrar os aparelhos usados pra coletar
// assinatura de colaborador.
function IconEstacaoHeader(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="5" y="2.5" width="14" height="19" rx="2.2" />
      <path d="M8 16.5c.9-1.1 1.7-1.1 2.3 0s1.3 1.1 2.1 0 1.5-1.1 2.3 0" />
      <path d="M10.5 6.3h3" />
    </svg>
  );
}

// Mesmo tablet do cabeçalho, só que pequeno e neutro (sem a linha de
// assinatura, que não sobrevive a 14px) — fica ao lado do nome da estação
// na tabela/cartão, mesmo tratamento de ícone por linha já usado em
// Colaboradores/EPIs/Movimentações (pedido do Rafael, 05/10/2026: "mesmo
// padrão" em toda tela de listagem).
function IconEstacaoRow(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <path d="M10.5 19h3" />
    </svg>
  );
}

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

  const estacoes = await listEstacoesAssinatura(user.empresaId);

  return (
    <div className="space-y-1">
      <AutoRefresh />
      <PageHeader
        title="Estações de assinatura"
        description="Aparelhos da própria empresa (tablet ou celular) fixados num ponto de coleta — o almoxarifado, por exemplo — pra coletar a assinatura do colaborador quando o registro é feito num computador sem tela touch. Nunca usa o celular pessoal do colaborador."
        icon={<IconEstacaoHeader className="h-5 w-5" />}
      />

      <ListToolbar actions={<NovaEstacaoButton />} />

      {/* Tabela — só a partir de `xl` (1280px), mesmo critério de
          Colaboradores/EPIs (ver comentário em colaboradores/page.tsx):
          abaixo disso ela não cabe de forma confiável sem rolar de lado.
          Sem `min-w` fixo (removido o antigo `min-w-[560px]`) — é a largura
          disponível de verdade quem decide o tamanho das colunas. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card xl:block">
        <table className="w-full border-collapse bg-surface text-left">
          <thead>
            <tr>
              {["Nome", "Aparelho", "Status", ""].map((label) => (
                <th
                  key={label || "acoes"}
                  className="border-b border-border-subtle bg-surface-muted px-4 py-3.5 text-[11px] font-semibold tracking-[0.04em] text-text-secondary uppercase"
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
                    className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-muted/70"
                  >
                    <td className="px-4 py-3.5 text-[13.5px] font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <IconEstacaoRow className="h-4 w-4 shrink-0 text-text-muted" />
                        {e.nome}
                      </div>
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
                        pareada={e.pareada}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Lista de cartões — telas abaixo de `xl` (ver comentário acima da
          tabela). Não precisa de ClickableCard: estação não tem tela de
          detalhe pra abrir, é só uma versão empilhada da mesma linha. */}
      <div className="space-y-2 xl:hidden">
        {estacoes.length === 0 ? (
          <p className="rounded-2xl border border-border-subtle bg-surface px-4 py-6 text-center text-[13px] text-text-muted">
            Nenhuma estação cadastrada ainda. Toque em &ldquo;+ Nova
            estação&rdquo; pra gerar o primeiro QR de pareamento.
          </p>
        ) : (
          estacoes.map((e) => {
            const status = e.pareada
              ? statusAparelho(e.ultimoPing)
              : "nunca_conectou";
            return (
              <div
                key={e.id}
                className="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconEstacaoRow className="h-4 w-4 shrink-0 text-text-muted" />
                    <span className="text-[13.5px] font-semibold text-foreground">
                      {e.nome}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
                      e.pareada
                        ? "bg-brand-100 text-brand-700"
                        : "bg-warning-bg text-warning-text"
                    }`}
                  >
                    {e.pareada ? "Pareado" : "Sem aparelho pareado"}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary"
                    title={STATUS_LABEL[status]}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`}
                    />
                    {e.ativo ? STATUS_LABEL[status] : "Desativada"}
                  </span>
                  <EstacaoRowActions
                    estacaoId={e.id}
                    estacaoNome={e.nome}
                    ativa={e.ativo}
                    pareada={e.pareada}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
