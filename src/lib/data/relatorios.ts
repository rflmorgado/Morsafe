import { createClient } from "@/lib/supabase/server";
import type { MotivoEntrega } from "@/types/database";
import { MOTIVO_ENTREGA_LABEL } from "./movimentacoes-labels";

// Janela padrão da tela de Relatórios — "últimos 12 meses" (rolante, inclui
// o mês corrente mesmo incompleto), escolhida com o Rafael em 06/10/2026
// junto com o resto do escopo desta tela (ver AskUserQuestion daquela
// conversa). Mantida como constante exportada (não hardcoded em cada lugar)
// porque tanto a tela quanto o PDF (relatorios/relatorio/route.ts) precisam
// do mesmo número pro texto "nos últimos N meses" nunca divergir.
export const JANELA_RELATORIO_MESES = 12;

function startOfMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// "Out/25" — rótulo de eixo com ano (2 dígitos), diferente do monthLabel do
// Dashboard (que não leva ano): a janela de 12 meses deste relatório cruza
// virada de ano o tempo todo (ex.: nov/25 a out/26), e sem o ano dois pontos
// de meses iguais (ex.: dois "Out") ficariam ambíguos no gráfico.
function monthLabel(date: Date) {
  const mes = date
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
  const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);
  const anoCurto = String(date.getFullYear()).slice(2);
  return `${mesCapitalizado}/${anoCurto}`;
}

function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

export type PontoMensalConsumo = {
  mesKey: string;
  label: string;
  quantidade: number;
  valor: number;
};

export type ConsumoSetor = {
  setorId: string;
  setorNome: string;
  unidadeNome: string;
  quantidade: number;
  valor: number;
};

export type ConsumoUnidade = {
  unidadeNome: string;
  quantidade: number;
  valor: number;
};

export type ConsumoTipoEpi = {
  tipo: string;
  quantidade: number;
  valor: number;
};

export type ConsumoMotivo = {
  motivo: MotivoEntrega;
  label: string;
  quantidade: number;
  valor: number;
  pct: number;
};

export type RelatorioConsumo = {
  janela: { meses: number; inicioLabel: string; fimLabel: string };
  totalQuantidade: number;
  totalValor: number;
  porMes: PontoMensalConsumo[];
  comparativoMes: {
    variacaoQuantidade: number | null;
    variacaoValor: number | null;
  };
  comparativoAno: {
    quantidadeAnterior: number;
    valorAnterior: number;
    variacaoQuantidade: number | null;
    variacaoValor: number | null;
  };
  porSetor: ConsumoSetor[];
  porUnidade: ConsumoUnidade[];
  porTipoEpi: ConsumoTipoEpi[];
  porMotivo: ConsumoMotivo[];
  // Recorte dos 3 motivos "anômalos" (nunca deveriam se repetir muito: dano,
  // perda, roubo) — o diferencial pedido pelo Rafael, 06/10/2026
  // ("Motivo das entregas — desgaste, dano, perda, roubo"). Separado de
  // `porMotivo` pra tela/PDF poderem destacar isso como um alerta de custo,
  // não só mais uma fatia de gráfico igual às outras.
  consumoAnomalo: {
    quantidade: number;
    valor: number;
    pct: number;
  };
  entradasPorTipo: ConsumoTipoEpi[];
  entradasTotal: { quantidade: number; valor: number };
};

const RELATORIO_VAZIO: RelatorioConsumo = {
  janela: { meses: JANELA_RELATORIO_MESES, inicioLabel: "", fimLabel: "" },
  totalQuantidade: 0,
  totalValor: 0,
  porMes: [],
  comparativoMes: { variacaoQuantidade: null, variacaoValor: null },
  comparativoAno: {
    quantidadeAnterior: 0,
    valorAnterior: 0,
    variacaoQuantidade: null,
    variacaoValor: null,
  },
  porSetor: [],
  porUnidade: [],
  porTipoEpi: [],
  porMotivo: [],
  consumoAnomalo: { quantidade: 0, valor: 0, pct: 0 },
  entradasPorTipo: [],
  entradasTotal: { quantidade: 0, valor: 0 },
};

const MOTIVOS_ANOMALOS = new Set<MotivoEntrega>(["troca_dano", "perda", "roubo"]);

type LinhaEntrega = {
  data: string;
  motivo: MotivoEntrega;
  custo_unitario_no_momento: number;
  colaboradores: { setor_id: string } | null;
  epis: { nome: string; tipo: string | null } | null;
};

type LinhaEntradaEstoque = {
  data_compra: string;
  quantidade: number;
  preco_unitario: number;
  epis: { tipo: string | null } | null;
};

/**
 * Apura os dados da tela de Relatórios de consumo de EPI — a tela em si
 * (pedido do Rafael, 06/10/2026: "Vamos a tela relatórios!"), separada do
 * Relatório (PDF) da Auditoria NR-06 (que é sobre conformidade do checklist,
 * não sobre consumo/gasto). Cobre as 5 informações que ele pediu (consumo
 * mensal, comparativo mês a mês e por ano, setor com maior consumo,
 * quantidades por tipo, entradas por tipo) mais o diferencial escolhido
 * (motivo das entregas, destacando perda/dano/roubo).
 *
 * Busca 24 meses de `entregas` numa só consulta (12 da janela atual + 12 da
 * janela anterior, só pra calcular a variação "por ano") em vez de duas
 * consultas separadas — mais simples e evita duas idas ao banco pra tabelas
 * que, na prática, não devem ter volume alto o bastante pra isso importar
 * (mesmo raciocínio de listSetoresComStatusAuditoria, em auditorias-nr06.ts).
 *
 * Setor → Unidade não dá pra trazer num só select aninhado (PostgREST não
 * encadeia 2 relacionamentos num único embed sem alias, e isso nunca foi
 * testado neste projeto) — por isso setores/unidades vêm numa consulta
 * separada e pequena (poucas dezenas de linhas por empresa), combinada aqui
 * em memória via Map, igual ao padrão já usado em listSetoresComStatusAuditoria.
 */
export async function apurarRelatorioConsumo(
  empresaId: string | null,
): Promise<RelatorioConsumo> {
  if (!empresaId) return RELATORIO_VAZIO;

  const supabase = await createClient();
  const hoje = new Date();

  const inicioJanelaAtual = startOfMonth(
    new Date(hoje.getFullYear(), hoje.getMonth() - (JANELA_RELATORIO_MESES - 1), 1),
  );
  const inicioJanelaAnterior = startOfMonth(
    new Date(hoje.getFullYear(), hoje.getMonth() - (2 * JANELA_RELATORIO_MESES - 1), 1),
  );

  const [
    { data: setoresData, error: setoresError },
    { data: unidadesData, error: unidadesError },
    { data: entregasData, error: entregasError },
    { data: entradasData, error: entradasError },
  ] = await Promise.all([
    supabase
      .from("setores")
      .select("id, nome, unidade_id")
      .eq("empresa_id", empresaId),
    supabase.from("unidades").select("id, nome").eq("empresa_id", empresaId),
    supabase
      .from("entregas")
      .select(
        "data, motivo, custo_unitario_no_momento, colaboradores ( setor_id ), epis ( nome, tipo )",
      )
      .eq("empresa_id", empresaId)
      .gte("data", inicioJanelaAnterior),
    supabase
      .from("entradas_estoque")
      .select("data_compra, quantidade, preco_unitario, epis ( tipo )")
      .eq("empresa_id", empresaId)
      .gte("data_compra", inicioJanelaAtual),
  ]);

  if (setoresError || unidadesError || entregasError || entradasError) {
    console.error(
      "apurarRelatorioConsumo:",
      setoresError?.message ?? unidadesError?.message ?? entregasError?.message ?? entradasError?.message,
    );
  }

  const unidadeNomePorId = new Map<string, string>();
  for (const u of unidadesData ?? []) unidadeNomePorId.set(u.id, u.nome);

  const setorInfoPorId = new Map<
    string,
    { nome: string; unidadeNome: string }
  >();
  for (const s of setoresData ?? []) {
    setorInfoPorId.set(s.id, {
      nome: s.nome,
      unidadeNome: unidadeNomePorId.get(s.unidade_id) ?? "—",
    });
  }

  const entregas = (entregasData ?? []) as unknown as LinhaEntrega[];
  const entradas = (entradasData ?? []) as unknown as LinhaEntradaEstoque[];

  const entregasAtual = entregas.filter((e) => e.data >= inicioJanelaAtual);
  const entregasAnterior = entregas.filter((e) => e.data < inicioJanelaAtual);

  // --- Série mensal (12 pontos, mais antigo primeiro) ---------------------
  const quantidadePorMes = new Map<string, number>();
  const valorPorMes = new Map<string, number>();
  for (const e of entregasAtual) {
    const chave = e.data.slice(0, 7);
    quantidadePorMes.set(chave, (quantidadePorMes.get(chave) ?? 0) + 1);
    valorPorMes.set(
      chave,
      (valorPorMes.get(chave) ?? 0) + Number(e.custo_unitario_no_momento ?? 0),
    );
  }
  const porMes: PontoMensalConsumo[] = Array.from(
    { length: JANELA_RELATORIO_MESES },
    (_, i) => {
      const data = new Date(
        hoje.getFullYear(),
        hoje.getMonth() - (JANELA_RELATORIO_MESES - 1 - i),
        1,
      );
      const chave = monthKey(data);
      return {
        mesKey: chave,
        label: monthLabel(data),
        quantidade: quantidadePorMes.get(chave) ?? 0,
        valor: Math.round((valorPorMes.get(chave) ?? 0) * 100) / 100,
      };
    },
  );

  const mesAtual = porMes[porMes.length - 1];
  const mesAnterior = porMes[porMes.length - 2] ?? null;

  // --- Totais e comparativos ------------------------------------------------
  const totalQuantidade = entregasAtual.length;
  const totalValor =
    Math.round(
      entregasAtual.reduce(
        (acc, e) => acc + Number(e.custo_unitario_no_momento ?? 0),
        0,
      ) * 100,
    ) / 100;

  const quantidadeAnterior = entregasAnterior.length;
  const valorAnterior =
    Math.round(
      entregasAnterior.reduce(
        (acc, e) => acc + Number(e.custo_unitario_no_momento ?? 0),
        0,
      ) * 100,
    ) / 100;

  // --- Por setor / por unidade ----------------------------------------------
  const setorAcc = new Map<string, { quantidade: number; valor: number }>();
  for (const e of entregasAtual) {
    const setorId = e.colaboradores?.setor_id;
    if (!setorId) continue;
    const atual = setorAcc.get(setorId) ?? { quantidade: 0, valor: 0 };
    atual.quantidade += 1;
    atual.valor += Number(e.custo_unitario_no_momento ?? 0);
    setorAcc.set(setorId, atual);
  }
  const porSetor: ConsumoSetor[] = Array.from(setorAcc.entries())
    .map(([setorId, v]) => {
      const info = setorInfoPorId.get(setorId);
      return {
        setorId,
        setorNome: info?.nome ?? "Setor removido",
        unidadeNome: info?.unidadeNome ?? "—",
        quantidade: v.quantidade,
        valor: Math.round(v.valor * 100) / 100,
      };
    })
    .sort((a, b) => b.valor - a.valor);

  const unidadeAcc = new Map<string, { quantidade: number; valor: number }>();
  for (const s of porSetor) {
    const atual = unidadeAcc.get(s.unidadeNome) ?? { quantidade: 0, valor: 0 };
    atual.quantidade += s.quantidade;
    atual.valor += s.valor;
    unidadeAcc.set(s.unidadeNome, atual);
  }
  const porUnidade: ConsumoUnidade[] = Array.from(unidadeAcc.entries())
    .map(([unidadeNome, v]) => ({
      unidadeNome,
      quantidade: v.quantidade,
      valor: Math.round(v.valor * 100) / 100,
    }))
    .sort((a, b) => b.valor - a.valor);

  // --- Por tipo de EPI (saídas) ---------------------------------------------
  const tipoAcc = new Map<string, { quantidade: number; valor: number }>();
  for (const e of entregasAtual) {
    const tipo = e.epis?.tipo?.trim() || "Não classificado";
    const atual = tipoAcc.get(tipo) ?? { quantidade: 0, valor: 0 };
    atual.quantidade += 1;
    atual.valor += Number(e.custo_unitario_no_momento ?? 0);
    tipoAcc.set(tipo, atual);
  }
  const porTipoEpi: ConsumoTipoEpi[] = Array.from(tipoAcc.entries())
    .map(([tipo, v]) => ({
      tipo,
      quantidade: v.quantidade,
      valor: Math.round(v.valor * 100) / 100,
    }))
    .sort((a, b) => b.valor - a.valor);

  // --- Por motivo (+ recorte anômalo: dano/perda/roubo) ---------------------
  const motivoAcc = new Map<MotivoEntrega, { quantidade: number; valor: number }>();
  for (const e of entregasAtual) {
    const atual = motivoAcc.get(e.motivo) ?? { quantidade: 0, valor: 0 };
    atual.quantidade += 1;
    atual.valor += Number(e.custo_unitario_no_momento ?? 0);
    motivoAcc.set(e.motivo, atual);
  }
  const porMotivo: ConsumoMotivo[] = Array.from(motivoAcc.entries())
    .map(([motivo, v]) => ({
      motivo,
      label: MOTIVO_ENTREGA_LABEL[motivo],
      quantidade: v.quantidade,
      valor: Math.round(v.valor * 100) / 100,
      pct: totalQuantidade > 0 ? Math.round((v.quantidade / totalQuantidade) * 100) : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  let quantidadeAnomala = 0;
  let valorAnomalo = 0;
  for (const m of porMotivo) {
    if (MOTIVOS_ANOMALOS.has(m.motivo)) {
      quantidadeAnomala += m.quantidade;
      valorAnomalo += m.valor;
    }
  }

  // --- Entradas de estoque por tipo ------------------------------------------
  const entradaAcc = new Map<string, { quantidade: number; valor: number }>();
  for (const ent of entradas) {
    const tipo = ent.epis?.tipo?.trim() || "Não classificado";
    const atual = entradaAcc.get(tipo) ?? { quantidade: 0, valor: 0 };
    atual.quantidade += ent.quantidade;
    atual.valor += ent.quantidade * Number(ent.preco_unitario ?? 0);
    entradaAcc.set(tipo, atual);
  }
  const entradasPorTipo: ConsumoTipoEpi[] = Array.from(entradaAcc.entries())
    .map(([tipo, v]) => ({
      tipo,
      quantidade: v.quantidade,
      valor: Math.round(v.valor * 100) / 100,
    }))
    .sort((a, b) => b.valor - a.valor);

  const entradasTotal = entradasPorTipo.reduce(
    (acc, t) => ({
      quantidade: acc.quantidade + t.quantidade,
      valor: Math.round((acc.valor + t.valor) * 100) / 100,
    }),
    { quantidade: 0, valor: 0 },
  );

  const dataInicio = new Date(`${inicioJanelaAtual}T00:00:00`);

  return {
    janela: {
      meses: JANELA_RELATORIO_MESES,
      inicioLabel: dataInicio.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
      fimLabel: hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    },
    totalQuantidade,
    totalValor,
    porMes,
    comparativoMes: {
      variacaoQuantidade: mesAnterior
        ? variacaoPct(mesAtual.quantidade, mesAnterior.quantidade)
        : null,
      variacaoValor: mesAnterior
        ? variacaoPct(mesAtual.valor, mesAnterior.valor)
        : null,
    },
    comparativoAno: {
      quantidadeAnterior,
      valorAnterior,
      variacaoQuantidade: variacaoPct(totalQuantidade, quantidadeAnterior),
      variacaoValor: variacaoPct(totalValor, valorAnterior),
    },
    porSetor,
    porUnidade,
    porTipoEpi,
    porMotivo,
    consumoAnomalo: {
      quantidade: quantidadeAnomala,
      valor: Math.round(valorAnomalo * 100) / 100,
      pct: totalQuantidade > 0 ? Math.round((quantidadeAnomala / totalQuantidade) * 100) : 0,
    },
    entradasPorTipo,
    entradasTotal,
  };
}
