import { createClient } from "@/lib/supabase/server";
import {
  MOTIVO_ENTREGA_LABEL,
  MOTIVO_DEVOLUCAO_LABEL,
} from "@/lib/data/movimentacoes-labels";

export const COLABORADORES_PAGE_SIZE = 20;

export type ListColaboradoresOptions = {
  empresaId: string | null;
  query?: string;
  setorId?: string;
  status?: string;
  // "pendente" isola quem está sem data_integracao_seguranca preenchida —
  // pedido do Rafael depois de importar uma planilha com a coluna
  // "Integração/NR 06" nova: ele precisa achar rápido, entre dezenas/
  // centenas de colaboradores, só os que ficaram sem essa data pra
  // completar manualmente (editar colaborador → campo Integração/NR-06).
  nr06?: string;
  sort?: string;
  dir?: string;
  page?: number;
};

const SORT_COLUMNS = ["nome", "setor", "cargo", "status", "ultima_entrega"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function isSortColumn(value: string | undefined): value is SortColumn {
  return !!value && (SORT_COLUMNS as readonly string[]).includes(value);
}

type ColaboradorOrdenavel = {
  nome: string;
  setor: string;
  cargo: string;
  status: string;
  ultimaEntrega: string | null;
};

/**
 * Ordenação por coluna compartilhada entre a listagem da tela e a
 * exportação em CSV — as duas precisam ordenar do mesmo jeito, inclusive
 * por "última entrega" (que não é uma coluna do banco, ver comentário
 * acima). Ordena em memória e retorna um array novo.
 */
function ordenarColaboradores<T extends ColaboradorOrdenavel>(
  lista: T[],
  sort: string | undefined,
  dir: string | undefined,
): T[] {
  const sortKey: SortColumn = isSortColumn(sort) ? sort : "nome";
  const ascending = dir !== "desc";

  return [...lista].sort((a, b) => {
    let cmp: number;
    if (sortKey === "ultima_entrega") {
      // Colaboradores sem nenhuma entrega registrada sempre vão para o
      // final da lista, independente da direção — não tem "mais recente"
      // ou "mais antigo" pra comparar quando não existe entrega nenhuma.
      if (!a.ultimaEntrega && !b.ultimaEntrega) return 0;
      if (!a.ultimaEntrega) return 1;
      if (!b.ultimaEntrega) return -1;
      cmp =
        a.ultimaEntrega < b.ultimaEntrega
          ? -1
          : a.ultimaEntrega > b.ultimaEntrega
            ? 1
            : 0;
    } else {
      const va = String(a[sortKey]).toLowerCase();
      const vb = String(b[sortKey]).toLowerCase();
      cmp = va < vb ? -1 : va > vb ? 1 : 0;
    }
    return ascending ? cmp : -cmp;
  });
}

/**
 * Lista paginada de colaboradores (20 por página por padrão), com busca por
 * nome, filtro por setor/status e ordenação por coluna — inclusive por
 * "última entrega", que não é uma coluna da tabela colaboradores, vem de uma
 * consulta separada em `entregas`. Por causa disso, em vez de ordenar e
 * paginar direto no banco, buscamos todos os colaboradores que batem com o
 * filtro, ordenamos em memória e só depois fatiamos a página — tranquilo para
 * o volume de colaboradores de uma empresa (dezenas a poucas centenas) e
 * evita ter que replicar a ordenação por "última entrega" dentro do SQL.
 *
 * `empresaId` filtra explicitamente — antes dependia só do RLS pra isolar
 * os colaboradores de uma empresa cliente dos de outra, na contramão do
 * padrão de defesa em profundidade do resto do projeto. `null` (usuário
 * sem empresa) sempre retorna lista vazia, sem consultar o banco. A
 * subconsulta de `entregas` abaixo não precisa do próprio filtro: já fica
 * implicitamente restrita à mesma empresa porque só busca pelos `ids` desta
 * lista, que já vieram filtrados.
 */
export async function listColaboradores({
  empresaId,
  query,
  setorId,
  status,
  nr06,
  sort,
  dir,
  page = 1,
}: ListColaboradoresOptions) {
  if (!empresaId) return { colaboradores: [], total: 0 };

  const supabase = await createClient();

  let request = supabase
    .from("colaboradores")
    .select(
      "id, nome, status, setor_id, cargo_id, cpf, telefone, data_integracao_seguranca, setores ( nome ), cargos ( nome )",
    )
    .eq("empresa_id", empresaId);

  if (query && query.trim()) {
    request = request.ilike("nome", `%${query.trim()}%`);
  }
  if (setorId) {
    request = request.eq("setor_id", setorId);
  }
  if (status === "ativo" || status === "inativo") {
    request = request.eq("status", status);
  }
  if (nr06 === "pendente") {
    request = request.is("data_integracao_seguranca", null);
  }

  const { data, error } = await request;

  if (error || !data) {
    console.error("listColaboradores:", error?.message);
    return { colaboradores: [], total: 0 };
  }

  const ids = data.map((c) => c.id);
  const { data: entregas } = ids.length
    ? await supabase
        .from("entregas")
        .select("colaborador_id, data")
        .in("colaborador_id", ids)
        .order("data", { ascending: false })
    : { data: [] as { colaborador_id: string; data: string }[] };

  const ultimaEntrega = new Map<string, string>();
  for (const e of entregas ?? []) {
    if (!ultimaEntrega.has(e.colaborador_id)) {
      ultimaEntrega.set(e.colaborador_id, e.data);
    }
  }

  const mapeados = data.map((c) => ({
    id: c.id,
    nome: c.nome,
    status: c.status,
    setorId: c.setor_id,
    cargoId: c.cargo_id,
    cpf: c.cpf,
    telefone: c.telefone,
    dataIntegracaoSeguranca: c.data_integracao_seguranca,
    setor: (c.setores as unknown as { nome: string } | null)?.nome ?? "—",
    cargo: (c.cargos as unknown as { nome: string } | null)?.nome ?? "—",
    ultimaEntrega: ultimaEntrega.get(c.id) ?? null,
  }));

  const ordenados = ordenarColaboradores(mapeados, sort, dir);

  const total = ordenados.length;
  const currentPage = page > 0 ? page : 1;
  const from = (currentPage - 1) * COLABORADORES_PAGE_SIZE;
  const to = from + COLABORADORES_PAGE_SIZE;

  return {
    colaboradores: ordenados.slice(from, to),
    total,
  };
}

export type Nr06StatusCounts = {
  emDia: number;
  pendente: number;
};

/**
 * Conta colaboradores ATIVOS com e sem a data de Integração/NR-06 preenchida
 * — usado pelo gráfico-resumo "Situação do NR-06" do Dashboard (ver
 * getDashboardData, em dashboard.ts). Só ativos: colaborador desligado não
 * precisa de treinamento em dia (mesmo filtro usado no filtro "NR-06: só
 * pendentes" da listagem, mas aqui sem paginar — só os dois totais).
 */
export async function getNr06StatusCounts(
  empresaId: string | null,
): Promise<Nr06StatusCounts> {
  if (!empresaId) return { emDia: 0, pendente: 0 };

  const supabase = await createClient();

  const [comData, semData] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("status", "ativo")
      .not("data_integracao_seguranca", "is", null),
    supabase
      .from("colaboradores")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("status", "ativo")
      .is("data_integracao_seguranca", null),
  ]);

  return {
    emDia: comData.count ?? 0,
    pendente: semData.count ?? 0,
  };
}

export type ListColaboradoresExportOptions = {
  empresaId: string | null;
  query?: string;
  setorId?: string;
  status?: string;
  nr06?: string;
  sort?: string;
  dir?: string;
};

/**
 * Mesma busca, os mesmos filtros e a mesma ordenação de listColaboradores,
 * mas sem paginação — usada pela exportação em CSV, que precisa trazer
 * todos os colaboradores que batem com o filtro atual da tela, não só os
 * 20 da página visível. Mesmo filtro explícito de empresa que
 * listColaboradores — `null` retorna lista vazia sem consultar o banco.
 */
export async function listColaboradoresParaExportar({
  empresaId,
  query,
  setorId,
  status,
  nr06,
  sort,
  dir,
}: ListColaboradoresExportOptions) {
  if (!empresaId) return [];

  const supabase = await createClient();

  let request = supabase
    .from("colaboradores")
    .select(
      "id, nome, status, cpf, telefone, data_integracao_seguranca, setores ( nome ), cargos ( nome )",
    )
    .eq("empresa_id", empresaId);

  if (query && query.trim()) {
    request = request.ilike("nome", `%${query.trim()}%`);
  }
  if (setorId) {
    request = request.eq("setor_id", setorId);
  }
  if (status === "ativo" || status === "inativo") {
    request = request.eq("status", status);
  }
  if (nr06 === "pendente") {
    request = request.is("data_integracao_seguranca", null);
  }

  const { data, error } = await request;

  if (error || !data) {
    console.error("listColaboradoresParaExportar:", error?.message);
    return [];
  }

  const ids = data.map((c) => c.id);
  const { data: entregas } = ids.length
    ? await supabase
        .from("entregas")
        .select("colaborador_id, data")
        .in("colaborador_id", ids)
        .order("data", { ascending: false })
    : { data: [] as { colaborador_id: string; data: string }[] };

  const ultimaEntrega = new Map<string, string>();
  for (const e of entregas ?? []) {
    if (!ultimaEntrega.has(e.colaborador_id)) {
      ultimaEntrega.set(e.colaborador_id, e.data);
    }
  }

  const mapeados = data.map((c) => ({
    nome: c.nome,
    status: c.status,
    setor: (c.setores as unknown as { nome: string } | null)?.nome ?? "—",
    cargo: (c.cargos as unknown as { nome: string } | null)?.nome ?? "—",
    cpf: c.cpf,
    telefone: c.telefone,
    dataIntegracaoSeguranca: c.data_integracao_seguranca,
    ultimaEntrega: ultimaEntrega.get(c.id) ?? null,
  }));

  return ordenarColaboradores(mapeados, sort, dir);
}

/**
 * `empresaId` confere que o colaborador pertence à empresa de quem está
 * pedindo a ficha, antes de buscar entregas/devoluções/recusas — mesmo
 * padrão de defesa em profundidade usado em excluirEpiDefinitivamente
 * (epis/actions.ts): sem essa checagem, bastava adivinhar/enumerar um id de
 * colaborador de OUTRA empresa cliente pra ver o histórico de entrega de
 * EPI dela, dependendo inteiramente do RLS pra bloquear isso.
 */
export async function getColaboradorDetalhe(
  id: string,
  empresaId: string | null,
) {
  if (!empresaId) return null;

  const supabase = await createClient();

  const { data: colaborador, error } = await supabase
    .from("colaboradores")
    .select(
      "id, nome, status, criado_em, data_integracao_seguranca, empresa_id, setores ( nome ), cargos ( nome )",
    )
    .eq("id", id)
    .single();

  if (error || !colaborador || colaborador.empresa_id !== empresaId) {
    return null;
  }

  // criado_em (timestamp do servidor, imutável) e o nome de quem registrou
  // (usuarios via criado_por) vão pra ficha em PDF — ver comentário em
  // ficha/route.ts sobre por que isso importa numa eventual ação
  // trabalhista: "data"/"hora" são digitados no formulário, criado_em não.
  const [entregas, devolucoes, recusas] = await Promise.all([
    supabase
      .from("entregas")
      .select(
        "id, data, hora, motivo, quantidade, assinatura_url, criado_em, epis ( nome, ca ), usuarios ( nome )",
      )
      .eq("colaborador_id", id)
      .order("data", { ascending: false }),
    supabase
      .from("devolucoes")
      .select(
        "id, data, motivo, destino, devolvido_fisicamente, assinatura_url, criado_em, epis ( nome, ca ), entregas ( quantidade ), usuarios ( nome )",
      )
      .eq("colaborador_id", id)
      .order("data", { ascending: false }),
    supabase
      .from("recusas")
      .select(
        "id, data, hora, observacoes, criado_em, epis ( nome, ca ), usuarios ( nome )",
      )
      .eq("colaborador_id", id)
      .order("data", { ascending: false }),
  ]);

  type Evento = {
    id: string;
    tipo: "entrega" | "devolucao" | "recusa";
    data: string;
    epi: string;
    ca: string | null;
    detalhe: string;
    // Entrega sempre tem; devolução tem a partir de quando a coluna
    // devolucoes.assinatura_url passou a existir (registros antigos ficam
    // null) — recusa nunca tem. Usada na ficha em PDF (ver ficha/route.ts)
    // pra mostrar a confirmação junto de cada item do histórico.
    assinaturaUrl?: string | null;
    // Só entrega e devolução têm quantidade (na devolução, vem da entrega
    // vinculada — ver comentário em EntregaEmPosse, lib/data/movimentacoes.ts).
    quantidade?: number;
    // Quem registrou (usuarios.nome via criado_por) e quando, de verdade —
    // ver comentário acima sobre criado_em. null só em registros muito
    // antigos, de antes dessas colunas existirem.
    responsavelNome: string | null;
    criadoEm: string | null;
  };

  const eventos: Evento[] = [
    ...(entregas.data ?? []).map((e) => ({
      id: `entrega-${e.id}`,
      tipo: "entrega" as const,
      data: e.data,
      epi: (e.epis as unknown as { nome: string; ca: string | null } | null)?.nome ?? "—",
      ca: (e.epis as unknown as { nome: string; ca: string | null } | null)?.ca ?? null,
      detalhe: MOTIVO_ENTREGA_LABEL[e.motivo] ?? e.motivo,
      assinaturaUrl: e.assinatura_url,
      quantidade: e.quantidade,
      responsavelNome: (e.usuarios as unknown as { nome: string } | null)?.nome ?? null,
      criadoEm: e.criado_em,
    })),
    ...(devolucoes.data ?? []).map((d) => ({
      id: `devolucao-${d.id}`,
      tipo: "devolucao" as const,
      data: d.data,
      epi: (d.epis as unknown as { nome: string; ca: string | null } | null)?.nome ?? "—",
      ca: (d.epis as unknown as { nome: string; ca: string | null } | null)?.ca ?? null,
      detalhe: `${MOTIVO_DEVOLUCAO_LABEL[d.motivo] ?? d.motivo}${
        d.devolvido_fisicamente ? "" : " · não devolvido fisicamente"
      }`,
      assinaturaUrl: d.assinatura_url,
      quantidade: (d.entregas as unknown as { quantidade: number } | null)?.quantidade,
      responsavelNome: (d.usuarios as unknown as { nome: string } | null)?.nome ?? null,
      criadoEm: d.criado_em,
    })),
    ...(recusas.data ?? []).map((r) => ({
      id: `recusa-${r.id}`,
      tipo: "recusa" as const,
      data: r.data,
      epi: (r.epis as unknown as { nome: string; ca: string | null } | null)?.nome ?? "—",
      ca: (r.epis as unknown as { nome: string; ca: string | null } | null)?.ca ?? null,
      detalhe: r.observacoes ?? "Recusa registrada",
      responsavelNome: (r.usuarios as unknown as { nome: string } | null)?.nome ?? null,
      criadoEm: r.criado_em,
    })),
  ].sort((a, b) => (a.data < b.data ? 1 : -1));

  return {
    id: colaborador.id,
    nome: colaborador.nome,
    status: colaborador.status,
    setor: (colaborador.setores as unknown as { nome: string } | null)?.nome ?? "—",
    cargo: (colaborador.cargos as unknown as { nome: string } | null)?.nome ?? "—",
    criadoEm: colaborador.criado_em,
    // Data da Integração de Segurança (admissão) ou da última
    // reciclagem/treinamento anual de NR-06, conforme a prática da empresa —
    // mesmo campo nos dois casos. Exibida na ficha em PDF (ver
    // ficha/route.ts) porque reforça a defesa da empresa numa eventual ação
    // trabalhista: mostra que não houve só a entrega do equipamento, mas
    // também orientação (e reciclagem) sobre o uso dele.
    dataIntegracaoSeguranca: colaborador.data_integracao_seguranca,
    eventos,
  };
}
