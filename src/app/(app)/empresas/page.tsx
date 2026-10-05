import Link from "next/link";
import { ClickableRow } from "@/components/ui/clickable-row";
import { ClickableCard } from "@/components/ui/clickable-card";
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

// Ícone vibrante do cabeçalho (mesmo tratamento de Dashboard/Colaboradores/
// EPIs/Usuários/Estoque) — o mesmo desenho de "prédios empilhados" do item
// de menu Empresas (ver IconEmpresas em nav-icons.tsx), porque esta tela é
// a lista de VÁRIAS empresas — diferente do prédio único (IconEmpresa) que
// representa "Dados da empresa"/a empresa ativa de quem está logado.
function IconEmpresasHeader(props: React.SVGProps<SVGSVGElement>) {
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
      <rect x="2.5" y="9" width="7" height="12" rx="1" />
      <rect x="10.5" y="3" width="7" height="18" rx="1" />
      <rect x="18.5" y="11" width="3" height="10" rx="0.8" />
      <path d="M5 13h1.5M5 16.5h1.5M13 6.5h3M13 10h3M13 13.5h3M13 17h3" />
    </svg>
  );
}

// Ícones pequenos e neutros (text-text-muted) dentro das células — mesmo
// padrão de colaboradores/page.tsx (IconLayers/IconIdBadge/IconCalendarSmall
// ao lado do dado, nunca um bloco colorido repetido linha a linha).
function IconDoc(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9 12.5h6M9 16h6" />
    </svg>
  );
}

function IconCalendarSmall(props: React.SVGProps<SVGSVGElement>) {
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
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

const LOGO_SIZE = {
  // "xs" pra tabela densa (tela larga), "sm" pros cartões (tela estreita,
  // uma linha por empresa, com espaço de sobra) — mesma ideia de tamanho
  // de components/ui/avatar.tsx, usada em Colaboradores/Usuários.
  xs: "h-6 w-6 rounded-md",
  sm: "h-8 w-8 rounded-lg",
} as const;

// Logo da empresa (PNG em data URL, ver logo-empresa-form.tsx) quando
// cadastrado, ou o mesmo ícone de prédio usado no selo da barra lateral
// (ver EmpresaBadge em app-shell.tsx) quando não — mesmos dois estados,
// só menor, pra dar a cada linha a mesma identidade visual que o Avatar
// (iniciais) já dá pra cada colaborador/usuário da plataforma.
function EmpresaLogo({
  logoUrl,
  size,
}: {
  logoUrl: string | null;
  size: "xs" | "sm";
}) {
  if (logoUrl) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-border-subtle ${LOGO_SIZE[size]}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, não um asset do Next */}
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-contain p-0.5"
        />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-brand-500 text-white ${LOGO_SIZE[size]}`}
      aria-hidden
    >
      <IconEmpresasHeader
        className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"}
        strokeWidth={2.2}
      />
    </span>
  );
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
        icon={<IconEmpresasHeader className="h-5 w-5" />}
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
        <>
          {/* Tabela — só a partir de `xl` (mesmo limite de colaboradores/
              usuarios/estoque: menu lateral + margens do card deixam pouco
              mais de 820px líquidos pra tabela nesse ponto). Abaixo disso
              vira a lista de cartões logo adiante (bloco `xl:hidden`). */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card xl:block">
            <table className="w-full border-collapse bg-surface text-left">
              <thead>
                <tr>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Empresa
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    CNPJ
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Status
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Colaboradores
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    EPIs
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Usuários
                  </th>
                  <th className="border-b border-border-subtle bg-surface-muted px-2.5 py-[9px] text-[10.5px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
                    Criada em
                  </th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <ClickableRow
                    key={e.id}
                    href={`/empresas/${e.id}`}
                    label={`Ver detalhes de ${e.nome}`}
                  >
                    <td className="max-w-[220px] px-2.5 py-[9px] text-[12.5px] font-medium text-foreground">
                      <div className="flex min-w-0 items-center gap-2">
                        <EmpresaLogo logoUrl={e.logoUrl} size="xs" />
                        <span className="min-w-0 truncate" title={e.nome}>
                          {e.nome}
                        </span>
                      </div>
                    </td>
                    {/* Sem o ícone de documento aqui (fica só no cartão,
                        abaixo) — numa tabela de 7 colunas já no limite dos
                        ~820px disponíveis a `xl`, o CNPJ sozinho ("99.999.
                        999/9999-99", sem nenhum ponto de quebra pro
                        navegador) já exige ~130px; o ícone só competia por
                        espaço que a coluna "Colaboradores" (rótulo mais
                        largo do cabeçalho) também precisa. Mesma lição de
                        estoque/page.tsx: ícone é reforço visual, não pode
                        ser o que estoura o orçamento da linha. */}
                    <td className="px-2.5 py-[9px] text-[12.5px] text-text-secondary">
                      {e.cnpj || "—"}
                    </td>
                    <td className="px-2.5 py-[9px]">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          e.ativo
                            ? "bg-brand-100 text-brand-700"
                            : "bg-danger-bg text-danger-text"
                        }`}
                      >
                        {e.ativo ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    {/* Selo de limite embaixo do número, não ao lado —
                        mesma lição de estoque/page.tsx: "No limite do
                        plano" (o mais longo dos dois) empurrava essa
                        coluna 30px além do que o cabeçalho "Colaboradores"
                        já exige sozinho, o suficiente pra estourar o
                        orçamento de ~820px da tabela a `xl`. Empilhado, o
                        próprio rótulo do cabeçalho (mais largo que o
                        conteúdo das células) é que acaba definindo a
                        largura da coluna. */}
                    <td className="px-2.5 py-[9px] text-[12.5px] text-foreground">
                      <div>
                        {e.totalColaboradores}
                        {e.limiteColaboradores !== null && (
                          <span className="text-text-muted">
                            {" "}
                            / {e.limiteColaboradores}
                          </span>
                        )}
                      </div>
                      {(() => {
                        const badge = statusLimiteColaboradores(
                          e.totalColaboradores,
                          e.limiteColaboradores,
                        );
                        return badge ? (
                          <div
                            className={`mt-0.5 inline-block whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${badge.classe}`}
                          >
                            {badge.texto}
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-2.5 py-[9px] text-[12.5px] text-foreground">
                      {e.totalEpis}
                    </td>
                    <td className="px-2.5 py-[9px] text-[12.5px] text-foreground">
                      {e.totalUsuarios}
                    </td>
                    <td className="px-2.5 py-[9px] text-[12.5px] text-foreground">
                      {formatDate(e.criadoEm)}
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lista de cartões — telas abaixo de `xl` (ver comentário acima
              da tabela). Mesmas informações, empilhadas em vez de em
              colunas. */}
          <div className="space-y-2 xl:hidden">
            {empresas.map((e) => {
              const badge = statusLimiteColaboradores(
                e.totalColaboradores,
                e.limiteColaboradores,
              );
              return (
                <ClickableCard
                  key={e.id}
                  href={`/empresas/${e.id}`}
                  label={`Ver detalhes de ${e.nome}`}
                  className="rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <EmpresaLogo logoUrl={e.logoUrl} size="sm" />
                      <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">
                        {e.nome}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                        e.ativo
                          ? "bg-brand-100 text-brand-700"
                          : "bg-danger-bg text-danger-text"
                      }`}
                    >
                      {e.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <IconDoc className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      {e.cnpj || "CNPJ não informado"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconCalendarSmall className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      {formatDate(e.criadoEm)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle pt-2.5 text-[12px] text-text-secondary">
                    <span>
                      <span className="font-semibold text-foreground">
                        {e.totalColaboradores}
                      </span>
                      {e.limiteColaboradores !== null && (
                        <span className="text-text-muted">
                          {" "}
                          / {e.limiteColaboradores}
                        </span>
                      )}{" "}
                      colaboradores
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">
                        {e.totalEpis}
                      </span>{" "}
                      EPIs
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">
                        {e.totalUsuarios}
                      </span>{" "}
                      usuários
                    </span>
                    {badge && (
                      <span
                        className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${badge.classe}`}
                      >
                        {badge.texto}
                      </span>
                    )}
                  </div>
                </ClickableCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
