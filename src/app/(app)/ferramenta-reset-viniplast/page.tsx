import { getCurrentUser } from "@/lib/data/current-user";
import { PageHeader } from "@/components/ui/page-header";
import { ResetEmpresaForm } from "./reset-empresa-form";

/**
 * FERRAMENTA TEMPORÁRIA — uso único, sem link em nenhum menu (acesso só por
 * URL direta, igual ao padrão já usado em /setup-empresa).
 *
 * Criada pra resetar os dados de teste da ViniPlast (Colaboradores, EPIs,
 * Estoque, Entradas, Entregas, Devoluções, Recusas, verificações de
 * documento e solicitações de assinatura) enquanto o painel do Supabase —
 * e portanto o SQL Editor, o caminho normal pra isso — está inacessível
 * (chamado aberto com o suporte do Supabase desde 28/09, ainda sem
 * resposta). Ver morsafe-reset-dados-viniplast.sql, que faz exatamente o
 * mesmo via SQL direto, pra quando o acesso ao painel voltar.
 *
 * ATENÇÃO — isto é uma exceção deliberada à regra 3 do CLAUDE.md, com
 * autorização explícita do dono do MorSafe (ver actions.ts para o
 * raciocínio completo). Depois de usada, esta pasta inteira
 * (ferramenta-reset-viniplast) deve ser apagada do repositório — nunca
 * deixar como um botão permanente, nem só pro super_admin.
 */
export default async function FerramentaResetViniplastPage() {
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

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Reset de dados de teste — ViniPlast"
        description="Ferramenta temporária de uso único, enquanto o painel do Supabase está fora do ar. Apaga Colaboradores, EPIs homologados, Estoque, Entradas de estoque, Entregas, Devoluções, Recusas, verificações de documento e solicitações de assinatura da ViniPlast. Mantém a empresa, os logins e a estrutura (unidades, setores, cargos)."
      />
      <ResetEmpresaForm />
    </div>
  );
}
