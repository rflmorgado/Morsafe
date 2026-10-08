import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PlanoAssinatura, StatusAssinatura } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

export type AssinaturaResumo = {
  id: string;
  empresaId: string;
  empresaNome: string;
  plano: PlanoAssinatura;
  valorMensal: number;
  status: StatusAssinatura;
  proximoVencimento: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

type AssinaturaRow = {
  id: string;
  empresa_id: string;
  plano: PlanoAssinatura;
  valor_mensal: number;
  status: StatusAssinatura;
  proximo_vencimento: string | null;
  criado_em: string;
  atualizado_em: string;
};

function mapRow(a: AssinaturaRow, empresaNome: string): AssinaturaResumo {
  return {
    id: a.id,
    empresaId: a.empresa_id,
    empresaNome,
    plano: a.plano,
    valorMensal: Number(a.valor_mensal),
    status: a.status,
    proximoVencimento: a.proximo_vencimento,
    criadoEm: a.criado_em,
    atualizadoEm: a.atualizado_em,
  };
}

export function formatStatusAssinatura(status: StatusAssinatura): {
  texto: string;
  classe: string;
} {
  switch (status) {
    case "ativa":
      return { texto: "Ativa", classe: "bg-brand-50 text-brand-700" };
    case "pendente":
      return { texto: "Pendente", classe: "bg-warning-bg text-warning-text" };
    case "inadimplente":
      return { texto: "Inadimplente", classe: "bg-danger-bg text-danger-text" };
    // Preenchimento sólido (não o par bg-danger-bg/text-danger-text, mais
    // suave) — "suspensa" já bloqueou o acesso operacional da empresa (ver
    // middleware.ts), um degrau mais grave que "inadimplente" (que ainda
    // está dentro do prazo de tolerância, ver cron verificar-
    // inadimplencia), então o badge também precisa parecer mais grave.
    case "suspensa":
      return { texto: "Suspensa", classe: "bg-danger-text text-white" };
    case "cancelada":
      return { texto: "Cancelada", classe: "bg-surface-muted text-text-muted" };
  }
}

export type AssinaturaDaEmpresa = {
  id: string;
  plano: PlanoAssinatura;
  valorMensal: number;
  status: StatusAssinatura;
  proximoVencimento: string | null;
};

/**
 * Assinatura da PRÓPRIA empresa do usuário logado — pra seção
 * "Assinatura" dentro de /empresa (ver app/(app)/empresa/page.tsx),
 * vista pelo admin da empresa cliente (diferente de /assinaturas, o
 * painel completo de todas as empresas, exclusivo do super_admin).
 *
 * Usa o cliente comum (sujeito a RLS, ver lib/supabase/server.ts), não o
 * admin client — `assinaturas` tem RLS desabilitado por design (ver
 * morsafe-add-assinaturas-asaas.sql), então o filtro por empresa_id
 * abaixo É a barreira de isolamento entre empresas aqui, igual já é em
 * getEmpresaAtual (lib/data/empresa.ts).
 *
 * Retorna null tanto em erro quanto no caso normal de uma empresa
 * "interno" (ViniPlast/Vinitrade, ver setup-empresa/actions.ts), que
 * nunca ganha uma linha em `assinaturas` — o chamador trata os dois
 * casos da mesma forma (simplesmente não mostra a seção).
 */
export async function getAssinaturaDaEmpresa(
  empresaId: string,
): Promise<AssinaturaDaEmpresa | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assinaturas")
    .select("id, plano, valor_mensal, status, proximo_vencimento")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getAssinaturaDaEmpresa:", error.message);
    return null;
  }

  return {
    id: data.id,
    plano: data.plano,
    valorMensal: Number(data.valor_mensal),
    status: data.status,
    proximoVencimento: data.proximo_vencimento,
  };
}

/**
 * Texto de aviso pra área de assinatura do cliente (ver getAssinaturaDaEmpresa) —
 * null quando está tudo normal (status "ativa"), pra seção só mostrar o
 * banner de aviso quando existe algo que precisa da atenção do admin da
 * empresa.
 */
export function avisoAssinatura(status: StatusAssinatura): string | null {
  switch (status) {
    case "pendente":
      return "Existe uma cobrança em aberto, ainda dentro do prazo de vencimento.";
    case "inadimplente":
      return "Pagamento atrasado — regularize para evitar a suspensão do acesso ao sistema.";
    case "suspensa":
      return "Acesso suspenso por falta de pagamento. Regularize o pagamento pendente para reativar.";
    case "cancelada":
      return "Assinatura cancelada.";
    case "ativa":
    default:
      return null;
  }
}

// Ordem de prioridade na lista consolidada — quem precisa de atenção
// primeiro: inadimplente (ainda dá pra evitar a suspensão ligando pro
// cliente), depois suspensa (já bloqueado, mas talvez precise de uma
// decisão manual — reativar depois do pagamento, ou cancelar de vez),
// depois pendente (cobrança em aberto, dentro do prazo, sem ação
// necessária ainda), ativa, e cancelada por último (não precisa de
// nenhuma atenção). Mesmo princípio de PRIORIDADE em lib/data/
// pagamentos.ts.
const PRIORIDADE: Record<StatusAssinatura, number> = {
  inadimplente: 0,
  suspensa: 1,
  pendente: 2,
  ativa: 3,
  cancelada: 4,
};

/**
 * Todas as assinaturas de todas as empresas clientes, pro painel
 * administrativo /assinaturas (ver app/(app)/assinaturas/page.tsx) — a
 * visão de negócio do super_admin sobre a cobrança recorrente via Asaas,
 * separada da tela /pagamentos (que é o ledger de cobranças individuais,
 * incluindo as lançadas manualmente antes do Asaas existir).
 */
export async function listAssinaturasConsolidado(): Promise<
  AssinaturaResumo[]
> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("assinaturas")
    .select(
      "id, empresa_id, plano, valor_mensal, status, proximo_vencimento, criado_em, atualizado_em, empresas ( nome )",
    )
    .order("criado_em", { ascending: false });

  if (error || !data) {
    console.error("listAssinaturasConsolidado:", error?.message);
    return [];
  }

  const mapeadas = data.map((a) =>
    mapRow(a, (a.empresas as unknown as { nome: string } | null)?.nome ?? "—"),
  );

  return mapeadas.sort(
    (a, b) =>
      PRIORIDADE[a.status] - PRIORIDADE[b.status] ||
      a.empresaNome.localeCompare(b.empresaNome),
  );
}

export type ResumoAssinaturas = {
  mrr: number;
  ativas: number;
  pendentes: number;
  inadimplentes: number;
  suspensas: number;
  canceladas: number;
  // Toda assinatura já criada (qualquer status, inclusive cancelada) —
  // "quantas vendas o Rafael já fez", não "quantas estão pagando hoje"
  // (isso já é ativas+pendentes+inadimplentes). Nome vem direto do modelo
  // comercial (seção do painel administrativo).
  implantacoesRealizadas: number;
};

/**
 * KPIs do painel /assinaturas: MRR e contagens por status.
 *
 * MRR (receita recorrente mensal) soma ativa + pendente + inadimplente —
 * as três representam um compromisso de cobrança que ainda está de pé
 * (a cobrança deste mês pode estar em aberto ou atrasada, mas a
 * assinatura ainda não foi suspensa nem cancelada). Suspensa e cancelada
 * ficam de fora: a primeira já teve o acesso bloqueado (não é mais
 * receita confiável até reativar), a segunda não existe mais. Essa é uma
 * definição razoável, não uma convenção universal — se o Rafael preferir
 * contar diferente (ex.: só "ativa"), é só mudar aqui, um lugar só.
 */
export async function getResumoAssinaturas(
  admin: AdminClient = createAdminClient(),
): Promise<ResumoAssinaturas> {
  const vazio: ResumoAssinaturas = {
    mrr: 0,
    ativas: 0,
    pendentes: 0,
    inadimplentes: 0,
    suspensas: 0,
    canceladas: 0,
    implantacoesRealizadas: 0,
  };

  const { data, error } = await admin.from("assinaturas").select(
    "status, valor_mensal",
  );

  if (error || !data) {
    console.error("getResumoAssinaturas:", error?.message);
    return vazio;
  }

  const resumo = { ...vazio, implantacoesRealizadas: data.length };

  for (const row of data) {
    const valor = Number(row.valor_mensal);
    switch (row.status as StatusAssinatura) {
      case "ativa":
        resumo.ativas++;
        resumo.mrr += valor;
        break;
      case "pendente":
        resumo.pendentes++;
        resumo.mrr += valor;
        break;
      case "inadimplente":
        resumo.inadimplentes++;
        resumo.mrr += valor;
        break;
      case "suspensa":
        resumo.suspensas++;
        break;
      case "cancelada":
        resumo.canceladas++;
        break;
    }
  }

  return resumo;
}
