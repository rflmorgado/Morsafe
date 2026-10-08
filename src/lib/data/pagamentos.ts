import { createAdminClient } from "@/lib/supabase/admin";
import type { StatusPagamentoEmpresa } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

// Quantos dias antes do vencimento um pagamento pendente já conta como
// "a vencer" (alerta amarelo) em vez de "em dia" — usado tanto na lista
// consolidada quanto no resumo do Dashboard do super_admin.
const DIAS_ALERTA_VENCIMENTO = 7;

export type StatusPagamentoComputado = "atrasado" | "a_vencer" | "em_dia" | "pago";

export type PagamentoEmpresa = {
  id: string;
  empresaId: string;
  empresaNome: string;
  valor: number;
  dataVencimento: string;
  status: StatusPagamentoEmpresa;
  statusComputado: StatusPagamentoComputado;
  dataPagamento: string | null;
  observacao: string | null;
  criadoEm: string;
  // Link da fatura hospedada pelo Asaas (Pix/boleto/cartão) — null em
  // cobrança sem Asaas por trás (controle 100% manual, ou campo ainda não
  // sincronizado). Ver comentário completo em types/database.ts.
  asaasInvoiceUrl: string | null;
};

type PagamentoRow = {
  id: string;
  empresa_id: string;
  valor: number;
  data_vencimento: string;
  status: StatusPagamentoEmpresa;
  data_pagamento: string | null;
  observacao: string | null;
  criado_em: string;
  asaas_invoice_url: string | null;
};

/**
 * "Atrasado"/"a vencer"/"em dia" nunca são gravados no banco (ver
 * morsafe-add-pagamentos-empresa.sql) — sempre calculados aqui a partir de
 * data_vencimento + status, pra nunca ficar desatualizado só porque
 * ninguém voltou na tela pra marcar como atrasado na data certa.
 */
function computarStatus(
  status: StatusPagamentoEmpresa,
  dataVencimento: string,
): StatusPagamentoComputado {
  if (status === "pago") return "pago";

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(dataVencimento + "T00:00:00");
  const diffDias = Math.round(
    (vencimento.getTime() - hoje.getTime()) / 86_400_000,
  );

  if (diffDias < 0) return "atrasado";
  if (diffDias <= DIAS_ALERTA_VENCIMENTO) return "a_vencer";
  return "em_dia";
}

export function formatStatusPagamento(status: StatusPagamentoComputado): {
  texto: string;
  classe: string;
} {
  switch (status) {
    case "atrasado":
      return { texto: "Atrasado", classe: "bg-danger-bg text-danger-text" };
    case "a_vencer":
      return {
        texto: "Vence em breve",
        classe: "bg-warning-bg text-warning-text",
      };
    case "pago":
      return { texto: "Pago", classe: "bg-surface-muted text-text-secondary" };
    case "em_dia":
    default:
      return { texto: "Em dia", classe: "bg-brand-50 text-brand-700" };
  }
}

function mapRow(p: PagamentoRow, empresaNome: string): PagamentoEmpresa {
  return {
    id: p.id,
    empresaId: p.empresa_id,
    empresaNome,
    valor: Number(p.valor),
    dataVencimento: p.data_vencimento,
    status: p.status,
    statusComputado: computarStatus(p.status, p.data_vencimento),
    dataPagamento: p.data_pagamento,
    observacao: p.observacao,
    criadoEm: p.criado_em,
    asaasInvoiceUrl: p.asaas_invoice_url,
  };
}

// Ordem de prioridade na lista consolidada: atrasado primeiro (precisa de
// ação agora), depois a vencer, depois em dia, pago por último — senão um
// pagamento já quitado só por ter vencimento antigo ficaria no topo da
// lista, empurrando o que realmente precisa de atenção pra baixo.
const PRIORIDADE: Record<StatusPagamentoComputado, number> = {
  atrasado: 0,
  a_vencer: 1,
  em_dia: 2,
  pago: 3,
};

/**
 * Todos os pagamentos de todas as empresas clientes, ordenados por
 * urgência — pra tela consolidada /pagamentos (ver
 * app/(app)/pagamentos/page.tsx), onde o super_admin acompanha quem está
 * em atraso sem precisar entrar empresa por empresa.
 */
export async function listPagamentosConsolidado(): Promise<PagamentoEmpresa[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("pagamentos_empresa")
    .select(
      "id, empresa_id, valor, data_vencimento, status, data_pagamento, observacao, criado_em, asaas_invoice_url, empresas ( nome )",
    )
    .order("data_vencimento", { ascending: true });

  if (error || !data) {
    console.error("listPagamentosConsolidado:", error?.message);
    return [];
  }

  const mapeados = data.map((p) =>
    mapRow(
      p,
      (p.empresas as unknown as { nome: string } | null)?.nome ?? "—",
    ),
  );

  return mapeados.sort(
    (a, b) =>
      PRIORIDADE[a.statusComputado] - PRIORIDADE[b.statusComputado] ||
      a.dataVencimento.localeCompare(b.dataVencimento),
  );
}

/**
 * Histórico de pagamentos de UMA empresa — pra seção "Pagamentos" dentro de
 * app/(app)/empresas/[id]/page.tsx. `empresaNome` é passado pelo chamador
 * (que já tem o dado de getEmpresaComResumo) em vez de embutir o join aqui,
 * pra não repetir a mesma consulta de novo.
 */
export async function listPagamentosDaEmpresa(
  empresaId: string,
  empresaNome: string,
): Promise<PagamentoEmpresa[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("pagamentos_empresa")
    .select(
      "id, empresa_id, valor, data_vencimento, status, data_pagamento, observacao, criado_em, asaas_invoice_url",
    )
    .eq("empresa_id", empresaId)
    .order("data_vencimento", { ascending: false });

  if (error || !data) {
    console.error("listPagamentosDaEmpresa:", error?.message);
    return [];
  }

  return data.map((p) => mapRow(p, empresaNome));
}

/**
 * Contagem de pagamentos pendentes em atraso / a vencer — alimenta o KPI
 * "Pagamentos pendentes" do Dashboard do super_admin (ver
 * lib/data/dashboard-super-admin.ts). Só busca os "pendente" (ignora os já
 * pagos, que nunca entram em nenhuma das duas contagens).
 */
export async function getResumoPagamentos(
  admin: AdminClient = createAdminClient(),
): Promise<{ atrasados: number; aVencer: number }> {
  const { data, error } = await admin
    .from("pagamentos_empresa")
    .select("data_vencimento, status")
    .eq("status", "pendente");

  if (error || !data) {
    console.error("getResumoPagamentos:", error?.message);
    return { atrasados: 0, aVencer: 0 };
  }

  let atrasados = 0;
  let aVencer = 0;
  for (const row of data) {
    const status = computarStatus(row.status, row.data_vencimento);
    if (status === "atrasado") atrasados++;
    else if (status === "a_vencer") aVencer++;
  }

  return { atrasados, aVencer };
}
