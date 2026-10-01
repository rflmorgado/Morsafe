import { createClient } from "@/lib/supabase/server";
import { listEpis, type Epi } from "./epis";

export const ESTOQUE_PAGE_SIZE = 20;
export const ENTRADAS_ESTOQUE_PAGE_SIZE = 10;

// Mesmos defaults da coluna em `estoque` (ver morsafe-schema.sql) — usados
// aqui só pra EPI que ainda não tem linha na tabela (nenhuma entrada de
// compra registrada ainda: só o trigger fn_registrar_entrada_estoque cria
// essa linha, na primeira entrada).
const SALDO_PADRAO = 0;
const LIMITE_ALERTA_PADRAO = 5;

// "critico" (abaixo do limite) = vermelho, "alerta" (exatamente no limite) =
// laranja, "ok" (acima do limite) = verde — pedido do Rafael, mesma lógica
// de 3 cores já usada pra validade de C.A. em epis/page.tsx (statusCa).
export type StatusEstoque = "critico" | "alerta" | "ok";

export type ItemEstoque = {
  id: string;
  nome: string;
  tipo: string | null;
  ca: string | null;
  custoMedioAtual: number;
  saldoAtual: number;
  limiteAlerta: number;
  statusEstoque: StatusEstoque;
};

export type ListEstoqueOptions = {
  empresaId: string | null;
  query?: string;
  tipo?: string;
  sort?: string;
  dir?: string;
  page?: number;
};

/**
 * Saldo atual por EPI (ativo). Reaproveita listEpis — mesma busca por nome,
 * filtro por tipo e ordenação/paginação já testados em lib/data/epis.ts —
 * pra trazer a página de EPIs, e busca à parte em `estoque` só o saldo/
 * limite desses EPIs, juntando os dois em memória.
 *
 * Por que não um .select() embutido (epis -> estoque)? `database.ts` é
 * mantido à mão (ver comentário no topo dele) e a FK `estoque_epi_id_fkey`
 * só está declarada do lado de `estoque`, não em `Relationships` de `epis`
 * — um embed nesse sentido (de epis para estoque) cairia em `never` no
 * parser de tipos. Duas buscas separadas, juntadas por epi_id, evita
 * depender dessa relação inversa.
 *
 * Só mostra EPIs ativos: controle de estoque é operação do dia a dia, e um
 * EPI desativado já saiu do catálogo corrente (mesmo raciocínio de
 * listEpisAtivos, em movimentacoes.ts).
 */
export async function listEstoquePorEpi({
  empresaId,
  query,
  tipo,
  sort,
  dir,
  page = 1,
}: ListEstoqueOptions): Promise<{ itens: ItemEstoque[]; total: number }> {
  if (!empresaId) return { itens: [], total: 0 };

  const { epis, total } = await listEpis({
    empresaId,
    query,
    tipo,
    status: "ativo",
    sort,
    dir,
    page,
  });

  if (epis.length === 0) return { itens: [], total };

  const supabase = await createClient();
  const { data: linhasEstoque, error } = await supabase
    .from("estoque")
    .select("epi_id, saldo_atual, limite_alerta")
    .eq("empresa_id", empresaId)
    .in(
      "epi_id",
      epis.map((e) => e.id),
    );

  if (error) {
    console.error("listEstoquePorEpi:", error.message);
  }

  const porEpiId = new Map((linhasEstoque ?? []).map((l) => [l.epi_id, l]));

  const itens: ItemEstoque[] = epis.map((e: Epi) => {
    const linha = porEpiId.get(e.id);
    const saldoAtual = linha?.saldo_atual ?? SALDO_PADRAO;
    const limiteAlerta = linha?.limite_alerta ?? LIMITE_ALERTA_PADRAO;
    const statusEstoque: StatusEstoque =
      saldoAtual < limiteAlerta
        ? "critico"
        : saldoAtual === limiteAlerta
          ? "alerta"
          : "ok";
    return {
      id: e.id,
      nome: e.nome,
      tipo: e.tipo,
      ca: e.ca,
      custoMedioAtual: e.custoMedioAtual,
      saldoAtual,
      limiteAlerta,
      statusEstoque,
    };
  });

  return { itens, total };
}

export type EstoqueStatusCounts = {
  critico: number;
  alerta: number;
  ok: number;
};

/**
 * Mesmo corte de 3 status de listEstoquePorEpi acima (critico/alerta/ok),
 * mas só a contagem de cada um, pra todo EPI ativo da empresa — usado pelo
 * gráfico-resumo "Situação do estoque" do Dashboard (ver getDashboardData,
 * em dashboard.ts), que não precisa do nome/tipo/custo de cada EPI, só dos
 * totais. Pedido do Rafael junto com os outros gráficos do Dashboard
 * (conversa de 01/10/2026).
 */
export async function getEstoqueStatusCounts(
  empresaId: string | null,
): Promise<EstoqueStatusCounts> {
  if (!empresaId) return { critico: 0, alerta: 0, ok: 0 };

  const supabase = await createClient();

  const { data: epis, error: episError } = await supabase
    .from("epis")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("ativo", true);

  if (episError) {
    console.error("getEstoqueStatusCounts (epis):", episError.message);
  }
  if (!epis || epis.length === 0) {
    return { critico: 0, alerta: 0, ok: 0 };
  }

  const { data: linhasEstoque, error } = await supabase
    .from("estoque")
    .select("epi_id, saldo_atual, limite_alerta")
    .eq("empresa_id", empresaId)
    .in(
      "epi_id",
      epis.map((e) => e.id),
    );

  if (error) {
    console.error("getEstoqueStatusCounts:", error.message);
  }

  const porEpiId = new Map((linhasEstoque ?? []).map((l) => [l.epi_id, l]));

  const counts: EstoqueStatusCounts = { critico: 0, alerta: 0, ok: 0 };
  for (const epi of epis) {
    const linha = porEpiId.get(epi.id);
    const saldoAtual = linha?.saldo_atual ?? SALDO_PADRAO;
    const limiteAlerta = linha?.limite_alerta ?? LIMITE_ALERTA_PADRAO;
    if (saldoAtual < limiteAlerta) counts.critico++;
    else if (saldoAtual === limiteAlerta) counts.alerta++;
    else counts.ok++;
  }

  return counts;
}

export type EntradaEstoque = {
  id: string;
  epiId: string;
  epiNome: string;
  epiCa: string | null;
  quantidade: number;
  precoUnitario: number;
  fornecedor: string | null;
  notaFiscal: string | null;
  dataCompra: string;
  criadoEm: string;
  registradoPorNome: string | null;
};

/**
 * Histórico de entradas de estoque (compras registradas), mais recente
 * primeiro — paginado direto no banco (mesmo padrão de listLogsPorUsuario,
 * em log-auditoria.ts): uma tabela só, sem coluna derivada de outra tabela
 * pra ordenar, então não precisa da paginação em memória usada em
 * listMovimentacoes.
 */
export async function listEntradasEstoque({
  empresaId,
  page = 1,
}: {
  empresaId: string | null;
  page?: number;
}): Promise<{ entradas: EntradaEstoque[]; total: number }> {
  if (!empresaId) return { entradas: [], total: 0 };

  const supabase = await createClient();
  const currentPage = page > 0 ? page : 1;
  const from = (currentPage - 1) * ENTRADAS_ESTOQUE_PAGE_SIZE;
  const to = from + ENTRADAS_ESTOQUE_PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("entradas_estoque")
    .select(
      "id, epi_id, quantidade, preco_unitario, fornecedor, nota_fiscal, data_compra, criado_em, epis ( nome, ca ), usuarios ( nome )",
      { count: "exact" },
    )
    .eq("empresa_id", empresaId)
    .order("criado_em", { ascending: false })
    .range(from, to);

  if (error || !data) {
    console.error("listEntradasEstoque:", error?.message);
    return { entradas: [], total: 0 };
  }

  return {
    entradas: data.map((e) => ({
      id: e.id,
      epiId: e.epi_id,
      epiNome:
        (e.epis as unknown as { nome: string; ca: string | null } | null)
          ?.nome ?? "—",
      epiCa:
        (e.epis as unknown as { nome: string; ca: string | null } | null)
          ?.ca ?? null,
      quantidade: e.quantidade,
      precoUnitario: e.preco_unitario,
      fornecedor: e.fornecedor,
      notaFiscal: e.nota_fiscal,
      dataCompra: e.data_compra,
      criadoEm: e.criado_em,
      registradoPorNome:
        (e.usuarios as unknown as { nome: string } | null)?.nome ?? null,
    })),
    total: count ?? data.length,
  };
}
