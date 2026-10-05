import { getCurrentUser } from "@/lib/data/current-user";
import { listUsuariosDaEmpresa, statusPresenca } from "@/lib/data/usuarios";
import { Avatar } from "@/components/ui/avatar";
import { NovoUsuarioButton } from "./novo-usuario-button";
import { EditarPapelUsuarioButton } from "./editar-papel-usuario-button";
import { DesativarUsuarioButton } from "./desativar-usuario-button";
import { ReativarUsuarioButton } from "./reativar-usuario-button";
import { ExcluirUsuarioButton } from "./excluir-usuario-button";
import { HistoricoUsuarioButton } from "./historico-usuario-button";
import { AutoRefresh } from "./auto-refresh";
import { PageHeader } from "@/components/ui/page-header";
import { ListToolbar } from "@/components/ui/list-toolbar";

const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin",
  encarregado: "Encarregado",
  leitura: "Leitura",
};

// Bolinha de presença — verde (usando o sistema agora), laranja (logado,
// mas parado há um tempo) ou vermelho (offline/nunca esteve ativo). Ver
// limiares e regra completa em statusPresenca(). Fica encaixada no canto
// do Avatar (ver abaixo), mesmo lugar onde apps de chat mostram presença.
const PRESENCA_DOT: Record<ReturnType<typeof statusPresenca>, string> = {
  online: "bg-brand-500",
  ausente: "bg-warning-text",
  offline: "bg-danger-text",
};

const PRESENCA_LABEL: Record<ReturnType<typeof statusPresenca>, string> = {
  online: "Usando o sistema agora",
  ausente: "Ausente (logado, sem atividade recente)",
  offline: "Offline",
};

// Ícone vibrante do cabeçalho (mesmo tratamento de Dashboard/Colaboradores/
// EPIs/Movimentações/Estações/Empresa) — duas pessoas, o ícone universal de
// "usuários"/contas de acesso.
function IconUsuariosHeader(props: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6" />
      <path d="M16 9.2a2.8 2.8 0 1 0 0-5.6" />
      <path d="M15 13.3c2.6.4 4.5 2.6 4.5 6.2" />
    </svg>
  );
}

// Avatar (ver components/ui/avatar.tsx — mesma "cara" por iniciais usada em
// Colaboradores) com a bolinha de presença encaixada no canto, em vez de
// solta do lado do nome como era antes. Pedido do Rafael, 05/10/2026: mesmo
// padrão visual em toda tela de listagem — usuário de login é, antes de
// tudo, uma pessoa, igual colaborador.
function AvatarComPresenca({
  nome,
  presenca,
  size,
}: {
  nome: string;
  presenca: ReturnType<typeof statusPresenca>;
  size: "xs" | "sm";
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar nome={nome} size={size} />
      <span
        title={PRESENCA_LABEL[presenca]}
        className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${PRESENCA_DOT[presenca]}`}
      />
    </span>
  );
}

// Só admin da própria empresa acessa esta tela (nunca super_admin, que não
// tem empresa vinculada, e nunca encarregado/leitura) — checado aqui e de
// novo em cada Server Action, já que o cliente admin usado pra listar/
// editar ignora RLS por completo.
export default async function UsuariosPage() {
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

  // listUsuariosDaEmpresa usa o cliente admin (service role) — se a
  // variável SUPABASE_SERVICE_ROLE_KEY não estiver configurada no Vercel,
  // ele lança um erro aqui. Sem este try/catch, isso derrubava a página
  // inteira com a tela genérica "This page couldn't load" do Next.js.
  let usuarios: Awaited<ReturnType<typeof listUsuariosDaEmpresa>> = [];
  let erroConfiguracao = false;
  try {
    usuarios = await listUsuariosDaEmpresa(user.empresaId);
  } catch (e) {
    console.error("UsuariosPage:", e);
    erroConfiguracao = true;
  }

  if (erroConfiguracao) {
    return (
      <div className="space-y-1">
        <PageHeader title="Usuários" />
        <p className="mt-4 max-w-md rounded-lg bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger-text">
          Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY
          ausente no Vercel). Adicione essa variável de ambiente em
          Settings &gt; Environment Variables e faça um novo deploy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <AutoRefresh />
      <PageHeader
        title="Usuários"
        description="Quem tem acesso ao MorSafe na sua empresa."
        icon={<IconUsuariosHeader className="h-5 w-5" />}
      />

      <ListToolbar actions={<NovoUsuarioButton />} />

      {/* Tabela — só a partir de `xl` (1280px), mesmo critério de
          Colaboradores/EPIs/Movimentações/Estações (ver comentário em
          estacoes/page.tsx): abaixo disso ela não cabe de forma confiável
          sem rolar de lado, e aqui o pior caso (usuário inativo, 4 botões de
          ação: Histórico + Editar + Reativar + Excluir) é ainda mais largo
          que o de Estações. Sem `min-w` fixo (removido o antigo
          `min-w-[560px]`) — é a largura disponível de verdade quem decide o
          tamanho das colunas. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card xl:block">
        <table className="w-full border-collapse bg-surface text-left">
          <thead>
            <tr>
              {["Nome", "E-mail", "Papel", "Status", ""].map((label) => (
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
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-text-muted">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => {
                const vocêMesmo = u.id === user.id;
                const presenca = statusPresenca(u.ativo, u.ultimaAtividade);
                return (
                  <tr
                    key={u.id}
                    className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-muted/70"
                  >
                    <td className="max-w-[215px] px-4 py-3.5 text-[13.5px] font-medium text-foreground">
                      {/* min-w-0 no container e no nome é essencial aqui:
                          sem ele, um flex item nunca encolhe abaixo da
                          largura do texto sem quebra (comportamento padrão
                          de flexbox), e a coluna força a tabela a ultrapassar
                          os 820px disponíveis a `xl` mesmo com truncate. */}
                      <div className="flex min-w-0 items-center gap-2">
                        <AvatarComPresenca
                          nome={u.nome}
                          presenca={presenca}
                          size="xs"
                        />
                        <span className="min-w-0 truncate" title={u.nome}>
                          {u.nome}
                        </span>
                        {vocêMesmo && (
                          <span className="shrink-0 text-[11.5px] font-normal text-text-muted">
                            (você)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[190px] px-4 py-3.5 text-[13.5px] text-foreground">
                      <span className="block truncate" title={u.email}>
                        {u.email}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                      {PAPEL_LABEL[u.papel] ?? u.papel}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          u.ativo
                            ? "bg-brand-100 text-brand-700"
                            : "bg-danger-bg text-danger-text"
                        }`}
                      >
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <HistoricoUsuarioButton
                          usuarioId={u.id}
                          usuarioNome={u.nome}
                        />
                        {!vocêMesmo && (
                          <>
                            <EditarPapelUsuarioButton
                              usuarioId={u.id}
                              usuarioNome={u.nome}
                              papelAtual={u.papel}
                            />
                            {u.ativo ? (
                              <DesativarUsuarioButton
                                usuarioId={u.id}
                                usuarioNome={u.nome}
                              />
                            ) : (
                              <>
                                <ReativarUsuarioButton
                                  usuarioId={u.id}
                                  usuarioNome={u.nome}
                                />
                                <ExcluirUsuarioButton
                                  usuarioId={u.id}
                                  usuarioNome={u.nome}
                                />
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Lista de cartões — telas abaixo de `xl` (ver comentário acima da
          tabela). */}
      <div className="space-y-2 xl:hidden">
        {usuarios.length === 0 ? (
          <p className="rounded-2xl border border-border-subtle bg-surface px-4 py-6 text-center text-[13px] text-text-muted">
            Nenhum usuário encontrado.
          </p>
        ) : (
          usuarios.map((u) => {
            const vocêMesmo = u.id === user.id;
            const presenca = statusPresenca(u.ativo, u.ultimaAtividade);
            return (
              <div
                key={u.id}
                className="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AvatarComPresenca
                      nome={u.nome}
                      presenca={presenca}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <span className="text-[13.5px] font-semibold text-foreground">
                        {u.nome}
                      </span>
                      {vocêMesmo && (
                        <span className="ml-1.5 text-[11.5px] font-normal text-text-muted">
                          (você)
                        </span>
                      )}
                      <p className="truncate text-[12px] text-text-secondary">
                        {u.email}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
                      u.ativo
                        ? "bg-brand-100 text-brand-700"
                        : "bg-danger-bg text-danger-text"
                    }`}
                  >
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
                  <span className="text-[12.5px] text-text-secondary">
                    {PAPEL_LABEL[u.papel] ?? u.papel}
                  </span>
                  <div className="flex items-center gap-1">
                    <HistoricoUsuarioButton
                      usuarioId={u.id}
                      usuarioNome={u.nome}
                    />
                    {!vocêMesmo && (
                      <>
                        <EditarPapelUsuarioButton
                          usuarioId={u.id}
                          usuarioNome={u.nome}
                          papelAtual={u.papel}
                        />
                        {u.ativo ? (
                          <DesativarUsuarioButton
                            usuarioId={u.id}
                            usuarioNome={u.nome}
                          />
                        ) : (
                          <>
                            <ReativarUsuarioButton
                              usuarioId={u.id}
                              usuarioNome={u.nome}
                            />
                            <ExcluirUsuarioButton
                              usuarioId={u.id}
                              usuarioNome={u.nome}
                            />
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
