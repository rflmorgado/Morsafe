import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";

/**
 * Gera um código de verificação pública pra um documento (ex: Ficha de EPI)
 * e o consulta depois, sem exigir login — pensado pra um juiz, auditor ou
 * perito conseguir confirmar, só com o link/código impresso no rodapé do
 * PDF, que aquele documento foi realmente emitido pelo MorSafe, pra quem,
 * quando e com qual conteúdo. Ver comentário em types/database.ts sobre a
 * tabela `verificacoes_documento` (sem RLS, mesmo padrão de `empresas`) e em
 * lib/supabase/middleware.ts sobre /verificar ser rota pública.
 */

// 8 bytes aleatórios = 16 caracteres hex, 2^64 combinações — não dá pra
// adivinhar por força bruta, mas ainda é curto o bastante pra digitar à mão
// se precisar (o normal é abrir direto pelo link).
function gerarCodigo() {
  return crypto.randomBytes(8).toString("hex");
}

export type EventoParaHash = {
  id: string;
  tipo: string;
  data: string;
  criadoEm: string | null;
  epi: string;
  quantidade?: number;
};

/**
 * Hash de conteúdo do documento — não é uma trava de segurança, é uma
 * evidência técnica extra: se alguém baixar o PDF e alterar um valor nele
 * (numa ferramenta de edição de PDF) antes de juntar aos autos, o hash
 * impresso no rodapé não vai bater com o hash gravado aqui no banco no
 * momento em que o documento foi gerado de verdade.
 */
function calcularHash(payload: object) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export async function criarVerificacaoDocumento(params: {
  empresaId: string;
  empresaNome: string;
  colaboradorId: string;
  colaboradorNome: string;
  tipoDocumento: string;
  geradoPor: string | null;
  eventos: EventoParaHash[];
}): Promise<{ codigo: string; hash: string } | null> {
  const supabase = await createClient();

  // Ordena por id antes de calcular o hash — a consulta que monta `eventos`
  // (ver getColaboradorDetalhe) já ordena por data, mas empatando por id
  // garante que o hash não varie de uma geração pra outra só por causa da
  // ordem em que o banco devolveu linhas com a mesma data.
  const eventosOrdenados = [...params.eventos].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  const hash = calcularHash({
    empresaId: params.empresaId,
    colaboradorId: params.colaboradorId,
    eventos: eventosOrdenados,
  });

  // Tenta de novo só na chance (bem remota) de colisão do código único.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const codigo = gerarCodigo();
    const { error } = await supabase.from("verificacoes_documento").insert({
      codigo,
      empresa_id: params.empresaId,
      empresa_nome: params.empresaNome,
      colaborador_id: params.colaboradorId,
      colaborador_nome: params.colaboradorNome,
      tipo_documento: params.tipoDocumento,
      quantidade_eventos: params.eventos.length,
      hash_conteudo: hash,
      gerado_por: params.geradoPor,
    });

    if (!error) return { codigo, hash };
    if (error.code !== "23505") {
      console.error("criarVerificacaoDocumento:", error.message);
      return null;
    }
  }

  console.error("criarVerificacaoDocumento: falha após 3 tentativas (colisão de código).");
  return null;
}

export type VerificacaoDocumento = {
  codigo: string;
  empresaNome: string;
  colaboradorNome: string;
  tipoDocumento: string;
  quantidadeEventos: number;
  hash: string;
  geradoEm: string;
};

export async function getVerificacaoPorCodigo(
  codigo: string,
): Promise<VerificacaoDocumento | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("verificacoes_documento")
    .select(
      "codigo, empresa_nome, colaborador_nome, tipo_documento, quantidade_eventos, hash_conteudo, gerado_em",
    )
    .eq("codigo", codigo)
    .maybeSingle();

  if (error || !data) return null;

  return {
    codigo: data.codigo,
    empresaNome: data.empresa_nome,
    colaboradorNome: data.colaborador_nome,
    tipoDocumento: data.tipo_documento,
    quantidadeEventos: data.quantidade_eventos,
    hash: data.hash_conteudo,
    geradoEm: data.gerado_em,
  };
}
