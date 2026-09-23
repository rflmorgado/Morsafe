import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Rótulos padronizados de ação e de tabela, usados tanto ao gravar quanto ao
 * exibir o histórico — mantém o texto consistente entre todas as telas que
 * geram histórico (colaboradores, EPIs, usuários, e o que vier depois).
 */
export const ACAO_LABEL: Record<string, string> = {
  criado: "Cadastro criado",
  atualizado: "Cadastro editado",
  desligado: "Desligado",
  desativado: "Desativado",
  reativado: "Reativado",
  excluido: "Excluído definitivamente",
  papel_alterado: "Papel de acesso alterado",
  importado: "Importação em massa",
  exportado: "Exportação em CSV",
  baixou_ficha: "Ficha de EPI baixada",
  login: "Login",
  logout: "Logout",
};

export const TABELA_LABEL: Record<string, string> = {
  colaboradores: "Colaborador",
  epis: "EPI",
  usuarios: "Usuário",
  setores: "Setor",
  cargos: "Função",
  entregas: "Entrega de EPI",
  devolucoes: "Devolução de EPI",
  recusas: "Recusa de EPI",
};

// Artigo + substantivo por tabela, usado nas frases do histórico ("Cadastrou
// O COLABORADOR 'fulano'", "Cadastrou A FUNÇÃO 'soldador'"...) — evita ter
// que ficar comparando rótulo por rótulo dentro de cada case do switch
// abaixo conforme novas tabelas passam a gerar histórico.
const ARTIGO_REGISTRO: Record<string, string> = {
  colaboradores: "o colaborador",
  epis: "o EPI",
  usuarios: "o usuário",
  setores: "o setor",
  cargos: "a função",
  entregas: "a entrega de EPI",
  devolucoes: "a devolução de EPI",
  recusas: "a recusa de EPI",
};

type RegistrarLogParams = {
  supabase: SupabaseClient<Database>;
  empresaId: string;
  tabela: keyof typeof TABELA_LABEL | (string & {});
  registroId: string;
  acao: keyof typeof ACAO_LABEL | (string & {});
  usuarioId: string | null;
  detalhes?: Record<string, unknown> | null;
};

/**
 * Grava uma linha no histórico de ações (log_auditoria) — quem fez, o quê,
 * em qual cadastro e quando. `usuarioId` é sempre quem REALIZOU a ação (o
 * ator), nunca o registro afetado — isso importa em especial na exclusão de
 * usuário: loga o admin que excluiu, não o usuário excluído (que, a essa
 * altura, já não existe mais na tabela `usuarios`, e um FK pra um id
 * inexistente quebraria a gravação do log).
 *
 * Best-effort: chamado sempre DEPOIS que a mutação principal já deu certo;
 * se o registro do log falhar, não desfaz a ação em si, só loga o erro no
 * servidor — um histórico incompleto é preferível a travar o app inteiro
 * por causa da auditoria.
 */
export async function registrarLogAuditoria({
  supabase,
  empresaId,
  tabela,
  registroId,
  acao,
  usuarioId,
  detalhes,
}: RegistrarLogParams): Promise<void> {
  const { error } = await supabase.from("log_auditoria").insert({
    empresa_id: empresaId,
    tabela_referencia: tabela,
    registro_id: registroId,
    acao,
    usuario: usuarioId,
    detalhes: detalhes ?? null,
  });

  if (error) {
    console.error(`registrarLogAuditoria (${tabela}/${acao}):`, error.message);
  }
}

export type LogAuditoriaItem = {
  id: string;
  tabela: string;
  registroId: string;
  acao: string;
  detalhes: Record<string, unknown> | null;
  criadoEm: string;
};

export const HISTORICO_PAGE_SIZE = 25;

/**
 * Descreve uma linha do histórico em uma frase legível, a partir da ação,
 * da tabela afetada e do snapshot salvo em `detalhes` (nome do registro no
 * momento da ação, e — no caso de troca de papel — o de/para).
 */
export function descreverLogAuditoria(item: LogAuditoriaItem): string {
  const nome = (item.detalhes?.nome as string | undefined) ?? null;
  const tabelaLabel = TABELA_LABEL[item.tabela] ?? item.tabela;

  switch (item.acao) {
    case "criado": {
      const artigo = ARTIGO_REGISTRO[item.tabela];
      return nome
        ? `Cadastrou ${artigo ?? "um registro em " + tabelaLabel} "${nome}"`
        : `Criou um registro em ${tabelaLabel}`;
    }
    case "atualizado":
      return nome
        ? `Editou o cadastro de "${nome}"`
        : `Editou um registro em ${tabelaLabel}`;
    case "desligado":
      return nome ? `Desligou o colaborador "${nome}"` : "Desligou um colaborador";
    case "desativado":
      return nome
        ? `Desativou ${item.tabela === "epis" ? "o EPI" : "o acesso de"} "${nome}"`
        : `Desativou um registro em ${tabelaLabel}`;
    case "reativado":
      return nome ? `Reativou "${nome}"` : `Reativou um registro em ${tabelaLabel}`;
    case "excluido":
      return nome
        ? `Excluiu definitivamente "${nome}"`
        : `Excluiu definitivamente um registro em ${tabelaLabel}`;
    case "papel_alterado": {
      const de = item.detalhes?.de as string | undefined;
      const para = item.detalhes?.para as string | undefined;
      return `Alterou o papel de "${nome ?? "usuário"}"${
        de && para ? ` de ${de} para ${para}` : ""
      }`;
    }
    case "importado": {
      const qtd = item.detalhes?.quantidade as number | undefined;
      return `Importou ${qtd ?? "vários"} registro${qtd === 1 ? "" : "s"} em ${tabelaLabel}`;
    }
    case "exportado": {
      const qtd = item.detalhes?.quantidade as number | undefined;
      return `Exportou ${qtd ?? "vários"} registro${qtd === 1 ? "" : "s"} de ${tabelaLabel} em CSV`;
    }
    case "baixou_ficha":
      return nome ? `Baixou a ficha de EPI de "${nome}"` : "Baixou a ficha de EPI de um colaborador";
    case "login":
      return "Fez login no MorSafe";
    case "logout":
      return "Fez logout do MorSafe";
    default:
      return ACAO_LABEL[item.acao] ?? item.acao;
  }
}

/**
 * Histórico de ações REALIZADAS por um usuário (não ações sofridas por
 * ele) — usado na tela "Histórico" dentro de Usuários, pra rastreabilidade
 * de quem fez o quê dentro do app.
 *
 * Paginado (25 por página, por padrão) em vez de trazer tudo de uma vez:
 * uma importação em massa ou uma sequência de edições gera dezenas/centenas
 * de linhas de auditoria em minutos, e sem paginação a tela virava uma
 * rolagem enorme e sem fim. A paginação é feita direto no banco (`.range`),
 * não em memória, porque aqui não precisa reordenar por nada além de
 * "mais recente primeiro" — diferente da listagem de colaboradores, que
 * ordena por colunas que não existem todas na mesma tabela.
 */
export async function listLogsPorUsuario(
  supabase: SupabaseClient<Database>,
  usuarioId: string,
  { page = 1, pageSize = HISTORICO_PAGE_SIZE }: { page?: number; pageSize?: number } = {},
): Promise<{ logs: LogAuditoriaItem[]; total: number }> {
  const currentPage = page > 0 ? page : 1;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("log_auditoria")
    .select("id, tabela_referencia, registro_id, acao, detalhes, criado_em", {
      count: "exact",
    })
    .eq("usuario", usuarioId)
    .order("criado_em", { ascending: false })
    .range(from, to);

  if (error || !data) {
    console.error("listLogsPorUsuario:", error?.message);
    return { logs: [], total: 0 };
  }

  return {
    logs: data.map((l) => ({
      id: l.id,
      tabela: l.tabela_referencia,
      registroId: l.registro_id,
      acao: l.acao,
      detalhes: l.detalhes as Record<string, unknown> | null,
      criadoEm: l.criado_em,
    })),
    total: count ?? data.length,
  };
}
