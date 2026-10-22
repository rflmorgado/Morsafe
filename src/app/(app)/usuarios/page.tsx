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

// Nomes renomeados em 22/10/2026 a pedido do Rafael — "Admin/Encarregado/
// Leitura" descreviam bem o nível técnico, mas confundiam quem estava
// atribuindo o papel (ex: "Encarregado" soa como um cargo específico de
// obra, não como um nível de acesso). Os valores internos (papel no banco:
// "admin"/"encarregado"/"leitura") continuam os mesmos — isto é só o rótulo
// exibido na tela. Ver PAINEL_ACESSO abaixo pra explicação completa de cada
// um.
const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador",
  encarregado: "Operador",
  leitura: "Visualizador",
};

// Painel "O que cada papel pode fazer" (pedido do Rafael, 22/10/2026) —
// cada item abaixo reflete exatamente o que `temPapelMinimo` já aplica em
// cada Server Action (ver src/lib/auth/permissoes.ts e os
// actions.ts de cada tela: colaboradores, epis, estoque, movimentacoes,
// auditoria, estacoes, empresa). Se um nível mínimo mudar em algum desses
// arquivos, atualizar aqui também pra não ficar desalinhado.
const PAINEL_ACESSO: {
  papel: string;
  titulo: string;
  resumo: string;
  pode: string[];
  naoPode: string[];
}[] = [
  {
    papel: "admin",
    titulo: "Administrador",
    resumo: "Acesso total ao sistema.",
    pode: [
      "Tudo que o Operador faz, e também:",
      "Desligar, reativar e excluir colaboradores definitivamente",
      "Desativar e excluir EPIs homologados definitivamente",
      "Importar planilhas (colaboradores, EPIs, estoque)",
      "Gerenciar Estações de assinatura",
      "Editar Dados da empresa",
      "Gerenciar Usuários (criar, trocar papel, desativar)",
    ],
    naoPode: [],
  },
  {
    papel: "encarregado",
    titulo: "Operador",
    resumo: "O dia a dia operacional.",
    pode: [
      "Cadastrar e editar colaboradores, setores e cargos",
      "Cadastrar, editar, desativar e reativar EPIs homologados",
      "Registrar entregas, devoluções e recusas de EPI",
      "Entrada manual e ajuste de estoque",
      "Rodar a Auditoria NR-06",
    ],
    naoPode: [
      "Excluir colaborador ou EPI definitivamente",
      "Importar planilhas em massa",
      "Estações de assinatura, Dados da empresa e Usuários",
    ],
  },
  {
    papel: "leitura",
    titulo: "Visualizador",
    resumo: "Só consulta, não grava nada.",
    pode: [
      "Ver Dashboard, Colaboradores, EPIs, Movimentações, Estoque, Auditoria NR-06 e Relatórios",
    ],
    naoPode: [
      "Cadastrar, editar ou registrar qualquer coisa",
      "Estações de assinatura, Dados da empresa e Usuários (nem aparecem no menu)",
    ],
  },
];

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

// Seta do painel "O que cada papel pode fazer" — mesmo ícone/efeito de
// rotação (group-open:rotate-180) usado no FAQ do site público (ver
// src/app/page.tsx).
function IconChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  // ele lança um erro aqui; agora também lança se a própria consulta no
  // banco falhar (ver comentário em listUsuariosDaEmpresa, lib/data/
  // usuarios.ts) em vez de voltar uma lista vazia enganosa. Sem este
  // try/catch, qualquer um desses casos derrubava a página inteira com a
  // tela genérica "This page couldn't load" do Next.js.
  let usuarios: Awaited<ReturnType<typeof listUsuariosDaEmpresa>> = [];
  let erroCarregamento: string | null = null;
  try {
    usuarios = await listUsuariosDaEmpresa(user.empresaId);
  } catch (e) {
    console.error("UsuariosPage:", e);
    erroCarregamento =
      e instanceof Error ? e.message : "Erro desconhecido ao carregar.";
  }

  if (erroCarregamento) {
    return (
      <div className="space-y-1">
        <PageHeader title="Usuários" />
        <p className="mt-4 max-w-md rounded-lg bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger-text">
          {erroCarregamento.includes("SUPABASE_SERVICE_ROLE_KEY")
            ? "Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY ausente no Vercel). Adicione essa variável de ambiente em Settings > Environment Variables e faça um novo deploy."
            : erroCarregamento}
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

      {/* Painel "O que cada papel pode fazer" — pedido do Rafael,
          22/10/2026, junto com a renomeação dos papéis. Fica fechado por
          padrão (details/summary, sem JS — esta página é Server Component)
          pra não brigar por espaço com a tabela/lista logo abaixo; quem
          precisa decidir qual papel atribuir abre e vê os três lado a
          lado. */}
      <details className="group rounded-2xl border border-border-subtle bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[13px] font-semibold text-foreground">
          O que cada papel pode fazer
          <IconChevronDown className="h-4 w-4 shrink-0 text-text-muted transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-border-subtle p-4 sm:grid-cols-3">
          {PAINEL_ACESSO.map((p) => (
            <div
              key={p.papel}
              className="rounded-xl border border-border-subtle bg-surface-muted p-3.5"
            >
              <p className="text-[13px] font-semibold text-foreground">
                {p.titulo}
              </p>
              <p className="mt-0.5 text-[12px] text-text-secondary">
                {p.resumo}
              </p>

              <ul className="mt-3 space-y-1.5">
                {p.pode.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-1.5 text-[12px] leading-snug text-text-secondary"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-600" />
                    {item}
                  </li>
                ))}
              </ul>

              {p.naoPode.length > 0 && (
                <ul className="mt-2.5 space-y-1.5 border-t border-border-subtle pt-2.5">
                  {p.naoPode.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-1.5 text-[12px] leading-snug text-text-muted"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </details>

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
