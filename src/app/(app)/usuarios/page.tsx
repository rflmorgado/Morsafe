import { getCurrentUser } from "@/lib/data/current-user";
import { listUsuariosDaEmpresa } from "@/lib/data/usuarios";
import { NovoUsuarioButton } from "./novo-usuario-button";
import { EditarPapelUsuarioButton } from "./editar-papel-usuario-button";
import { DesativarUsuarioButton } from "./desativar-usuario-button";
import { ReativarUsuarioButton } from "./reativar-usuario-button";

const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin",
  encarregado: "Encarregado",
  leitura: "Leitura",
};

// Só admin da própria empresa acessa esta tela (nunca super_admin, que não
// tem empresa vinculada, e nunca encarregado/leitura) — checado aqui e de
// novo em cada Server Action, já que o cliente admin usado pra listar/
// editar ignora RLS por completo.
export default async function UsuariosPage() {
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
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Usuários
        </h2>
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
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Usuários
      </h2>
      <p className="mb-5 text-[13px] text-text-secondary">
        Quem tem acesso ao MorSafe na sua empresa.
      </p>

      <div className="mb-4 flex justify-end">
        <NovoUsuarioButton />
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border-subtle">
        <table className="w-full min-w-[560px] border-collapse bg-surface text-left">
          <thead>
            <tr>
              {["Nome", "E-mail", "Papel", "Status", ""].map((label) => (
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
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-text-muted">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => {
                const vocêMesmo = u.id === user.id;
                return (
                  <tr
                    key={u.id}
                    className="border-b border-border-subtle last:border-b-0"
                  >
                    <td className="px-4 py-3.5 text-[13.5px] font-medium text-foreground">
                      {u.nome}
                      {vocêMesmo && (
                        <span className="ml-1.5 text-[11.5px] font-normal text-text-muted">
                          (você)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-[13.5px] text-foreground">
                      {u.email}
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
                      {!vocêMesmo && (
                        <div className="flex items-center justify-end gap-1">
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
                            <ReativarUsuarioButton
                              usuarioId={u.id}
                              usuarioNome={u.nome}
                            />
                          )}
                        </div>
                      )}
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
