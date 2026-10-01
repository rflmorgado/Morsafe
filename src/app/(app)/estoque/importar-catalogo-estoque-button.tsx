"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Modal } from "@/components/ui/modal";
import { criarEpiCatalogo } from "../epis/actions";
import {
  importarEntradasEstoque,
  type ImportarEntradaEstoqueRow,
  type ImportarEntradaEstoqueFalha,
} from "./actions";
import type { EpiAtivo } from "@/lib/data/movimentacoes";

type RawRow = Record<string, unknown>;

type FieldKey =
  | "epi"
  | "tipo"
  | "ca"
  | "ca_validade"
  | "tamanho"
  | "custo_unitario"
  | "saldo";

const FIELD_LABEL: Record<FieldKey, string> = {
  epi: "EPI",
  tipo: "Tipo",
  ca: "C.A.",
  ca_validade: "Validade do C.A.",
  tamanho: "Tamanho",
  custo_unitario: "Custo unitário",
  saldo: "Saldo",
};

const CAMPOS_OBRIGATORIOS: FieldKey[] = ["epi", "custo_unitario", "saldo"];

const GUESS_KEYWORDS: Record<FieldKey, string[]> = {
  epi: ["epi", "equipamento", "nome", "descricao", "descrição", "item"],
  tipo: ["tipo", "categoria", "type"],
  ca: ["ca", "c.a", "certificado"],
  ca_validade: ["validade", "vencimento", "expira"],
  tamanho: ["tamanho", "numeracao", "numeração", "size", "tam"],
  custo_unitario: ["custo", "preco", "preço", "valor", "unitario", "unitário"],
  saldo: ["saldo", "quantidade", "qtd", "estoque", "qty"],
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function guessColumn(headers: string[], field: FieldKey): string {
  const keywords = GUESS_KEYWORDS[field];
  for (const kw of keywords) {
    const match = headers.find((h) => normalize(h).includes(kw));
    if (match) return match;
  }
  return "";
}

/**
 * Mesmo parser de data flexível de importar-epis-button.tsx/importar-estoque-
 * button.tsx (Date, "DD/MM/AAAA" ou "AAAA-MM-DD") — duplicado aqui de
 * propósito, mesmo padrão já usado entre os botões de importação deste
 * projeto (cada um com sua cópia pequena, sem uma dependência extra entre
 * telas que nada mais liga).
 */
function parseDataPlanilha(raw: unknown): string | null {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const texto = String(raw ?? "").trim();
  if (!texto) return null;

  const isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const brMatch = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

function parseNumeroPlanilha(raw: unknown): number | null {
  const texto = String(raw ?? "").trim();
  if (!texto) return null;
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

type ResolvedRow = {
  linha: number;
  epiNomeBase: string;
  tamanho: string;
  nomeFinal: string;
  tipo: string;
  ca: string;
  caValidade: string | null;
  custoUnitario: number | null;
  saldo: number | null;
  epiExistente: boolean;
  erro: string | null;
  aviso: string | null;
};

type Step = "upload" | "mapear" | "revisar";

type Resultado = {
  criados: number;
  inserted: number;
  semEstoque: number;
  falhas: ImportarEntradaEstoqueFalha[];
};

function statusLinha(r: ResolvedRow): { texto: string; className: string } {
  if (r.erro) {
    return { texto: r.erro, className: "text-danger-text" };
  }
  if (r.saldo === 0) {
    return {
      texto: r.epiExistente
        ? "✓ OK (sem entrada de estoque)"
        : "✓ Novo no catálogo (sem entrada de estoque)",
      className: "text-brand-700",
    };
  }
  if (!r.epiExistente) {
    return { texto: "✓ Será criado no catálogo", className: "text-brand-700" };
  }
  if (r.aviso) {
    return { texto: r.aviso, className: "text-warning-text" };
  }
  return { texto: "✓ OK", className: "text-brand-700" };
}

/**
 * Importação combinada de catálogo de EPI + estoque inicial, a partir de UMA
 * planilha só (EPI, Tipo, C.A., Validade do C.A., Tamanho, Custo unitário,
 * Saldo — Tipo é opcional, os demais seguem o modelo em Excel entregue ao
 * Rafael). Pensada pro onboarding de uma empresa nova como alternativa às
 * duas importações separadas ("Importar EPIs" + "Importar estoque inicial"):
 * em vez de montar duas planilhas que podem divergir uma da outra, uma só
 * alimenta as duas coisas de uma vez, sem risco de um EPI ficar faltando
 * catálogo ou faltando estoque.
 *
 * Tipo segue a mesma lista fixa do cadastro manual (ver epi-tipos.ts) e a
 * mesma detecção automática de coluna de importar-epis-button.tsx (procura
 * um cabeçalho como "Tipo"/"Categoria"/"Type" na planilha) — sem essa coluna
 * mapeada ou com a célula vazia, o EPI é criado sem tipo, igual ao cadastro
 * manual sem selecionar nada.
 *
 * Tamanho (quando preenchido) vira parte do NOME do EPI no catálogo — ex.:
 * "Bota de Segurança Branca" + "Nº 38" = "Bota de Segurança Branca Nº 38" —
 * em vez de uma coluna separada (não existe no banco, e não precisa: ver
 * conversa com Rafael, 01/10/2026). O mesmo C.A. pode legitimamente se
 * repetir em várias linhas (vários tamanhos do mesmo modelo); não há
 * constraint de unicidade em `epis.ca` nem `epis.nome`.
 *
 * Diferente de ImportarEstoqueButton (que exige o EPI já existir no catálogo
 * e oferece um `<select>` de override manual quando não bate), aqui o nome
 * final resolvido que não bate com nenhum EPI ativo é CRIADO automaticamente
 * no catálogo (uma chamada a criarEpiCatalogo por nome novo, com um Map
 * local evitando criar duplicado quando duas linhas da mesma planilha geram
 * o mesmo nome final) — esse auto-create é o ponto inteiro desta tela, então
 * não existe aqui a noção de "EPI não encontrado" como erro: só "novo" ou
 * "já existente".
 *
 * Depois de resolver (criar ou reaproveitar) o EPI de cada linha, reaproveita
 * a ação já existente `importarEntradasEstoque` (mesma validação, mesmo
 * padrão linha-a-linha com falha parcial) pra lançar as entradas de estoque
 * — nenhuma lógica de saldo/custo médio é duplicada aqui; o trigger do banco
 * (fn_registrar_entrada_estoque) continua sendo a única fonte de verdade.
 * Uma linha com Saldo = 0 só cria/reaproveita o EPI no catálogo, sem lançar
 * entrada nenhuma (uma "compra" de quantidade zero não faz sentido e violaria
 * a constraint de quantidade > 0 em entradas_estoque).
 *
 * Exige papel "admin" — mesmo nível de ImportarEstoqueButton/ImportarEpisButton
 * (ver estoque/page.tsx).
 */
export function ImportarCatalogoEstoqueButton({ epis }: { epis: EpiAtivo[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    epi: "",
    tipo: "",
    ca: "",
    ca_validade: "",
    tamanho: "",
    custo_unitario: "",
    saldo: "",
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pending, startTransition] = useTransition();

  function resetAll() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({
      epi: "",
      tipo: "",
      ca: "",
      ca_validade: "",
      tamanho: "",
      custo_unitario: "",
      saldo: "",
    });
    setParseError(null);
    setSubmitError(null);
    setResultado(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    setOpen(false);
    resetAll();
  }

  async function handleFile(file: File) {
    setParseError(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });

      if (rows.length === 0) {
        setParseError("A planilha está vazia ou não foi possível lê-la.");
        return;
      }

      const detectedHeaders = Object.keys(rows[0]);
      setHeaders(detectedHeaders);
      setRawRows(rows);
      setMapping({
        epi: guessColumn(detectedHeaders, "epi"),
        tipo: guessColumn(detectedHeaders, "tipo"),
        ca: guessColumn(detectedHeaders, "ca"),
        ca_validade: guessColumn(detectedHeaders, "ca_validade"),
        tamanho: guessColumn(detectedHeaders, "tamanho"),
        custo_unitario: guessColumn(detectedHeaders, "custo_unitario"),
        saldo: guessColumn(detectedHeaders, "saldo"),
      });
      setStep("mapear");
    } catch {
      setParseError(
        "Não foi possível ler esse arquivo. Confirme que é um Excel (.xlsx) ou CSV válido.",
      );
    }
  }

  const resolvedRows = useMemo<ResolvedRow[]>(() => {
    if (step !== "revisar") return [];

    return rawRows.map((row, i) => {
      const epiNomeBase = mapping.epi
        ? String(row[mapping.epi] ?? "").trim()
        : "";
      const tamanho = mapping.tamanho
        ? String(row[mapping.tamanho] ?? "").trim()
        : "";
      const tipo = mapping.tipo ? String(row[mapping.tipo] ?? "").trim() : "";
      const ca = mapping.ca ? String(row[mapping.ca] ?? "").trim() : "";
      const nomeFinal = (tamanho ? `${epiNomeBase} ${tamanho}` : epiNomeBase).trim();

      let erro: string | null = null;
      let aviso: string | null = null;

      if (!epiNomeBase) {
        erro = "EPI vazio";
      }

      const caValidadeCell = mapping.ca_validade
        ? row[mapping.ca_validade]
        : "";
      const temCaValidadeCell =
        caValidadeCell instanceof Date ||
        String(caValidadeCell ?? "").trim() !== "";
      const caValidade = temCaValidadeCell
        ? parseDataPlanilha(caValidadeCell)
        : null;
      if (temCaValidadeCell && !caValidade && !erro) {
        aviso = "Data do C.A. não reconhecida (ficará em branco)";
      }

      const custoCell = mapping.custo_unitario
        ? row[mapping.custo_unitario]
        : "";
      const custoUnitario = parseNumeroPlanilha(custoCell);
      if (!erro && (custoUnitario === null || custoUnitario < 0)) {
        erro = "Custo unitário inválido";
      }

      const saldoCell = mapping.saldo ? row[mapping.saldo] : "";
      const saldoBruto = parseNumeroPlanilha(saldoCell);
      const saldo =
        saldoBruto !== null && saldoBruto >= 0 ? Math.round(saldoBruto) : null;
      if (!erro && saldo === null) {
        erro = "Saldo inválido";
      }

      const epiExistente = nomeFinal
        ? epis.some((e) => normalize(e.nome) === normalize(nomeFinal))
        : false;

      return {
        linha: i + 2, // +2: cabeçalho é a linha 1 da planilha
        epiNomeBase,
        tamanho,
        nomeFinal,
        tipo,
        ca,
        caValidade,
        custoUnitario,
        saldo,
        epiExistente,
        erro,
        aviso,
      };
    });
  }, [step, rawRows, mapping, epis]);

  const validRows = resolvedRows.filter((r) => r.erro === null);
  const errorRows = resolvedRows.filter((r) => r.erro !== null);
  const novosNoCatalogo = validRows.filter((r) => !r.epiExistente).length;

  function handleConfirmar() {
    setSubmitError(null);
    startTransition(async () => {
      // Pré-carrega o catálogo atual (nome normalizado -> id) e vai ganhando
      // uma entrada nova a cada EPI criado nesta mesma importação — assim,
      // duas linhas da planilha com o mesmo nome final (ex.: duas entradas
      // de compra em datas diferentes do mesmo modelo/tamanho) reaproveitam
      // o EPI criado pela primeira, em vez de criar um duplicado.
      const catalogo = new Map<string, string>(
        epis.map((e) => [normalize(e.nome), e.id]),
      );

      const falhasCriacao: ImportarEntradaEstoqueFalha[] = [];
      const entradaRows: ImportarEntradaEstoqueRow[] = [];
      let criados = 0;
      let semEstoque = 0;

      for (const r of validRows) {
        const chave = normalize(r.nomeFinal);
        let epiId = catalogo.get(chave);

        if (!epiId) {
          const resultadoCriacao = await criarEpiCatalogo(
            r.nomeFinal,
            r.tipo || null,
            r.ca || null,
            r.caValidade,
          );
          if (resultadoCriacao.error || !resultadoCriacao.id) {
            falhasCriacao.push({
              linha: r.linha,
              epiNome: r.nomeFinal,
              erro: resultadoCriacao.error ?? "Não foi possível criar este EPI no catálogo.",
            });
            continue;
          }
          epiId = resultadoCriacao.id;
          catalogo.set(chave, epiId);
          criados++;
        }

        if (r.saldo === 0) {
          semEstoque++;
          continue;
        }

        entradaRows.push({
          linha: r.linha,
          epiId,
          epiNome: r.nomeFinal,
          quantidade: r.saldo!,
          precoUnitario: r.custoUnitario!,
          fornecedor: null,
          notaFiscal: null,
          dataCompra: null,
        });
      }

      let inserted = 0;
      let falhasEntrada: ImportarEntradaEstoqueFalha[] = [];

      if (entradaRows.length > 0) {
        const resultadoEntrada = await importarEntradasEstoque(entradaRows);
        if (resultadoEntrada.error) {
          setSubmitError(resultadoEntrada.error);
          return;
        }
        inserted = resultadoEntrada.inserted ?? 0;
        falhasEntrada = resultadoEntrada.falhas ?? [];
      }

      setResultado({
        criados,
        inserted,
        semEstoque,
        falhas: [...falhasCriacao, ...falhasEntrada],
      });
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border-strong px-4 py-2.5 text-[13.5px] font-semibold text-foreground transition hover:bg-surface-muted"
      >
        ⇪ Importar catálogo e estoque
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Importar catálogo e estoque"
      >
        {resultado !== null ? (
          <div className="space-y-4">
            {(resultado.criados > 0 ||
              resultado.inserted > 0 ||
              resultado.semEstoque > 0) && (
              <div className="space-y-1.5 rounded-lg bg-brand-50 px-3.5 py-3 text-[13.5px] font-medium text-brand-700">
                {resultado.criados > 0 && (
                  <p>
                    ✓ {resultado.criados}{" "}
                    {resultado.criados === 1
                      ? "item novo criado no catálogo"
                      : "itens novos criados no catálogo"}
                    .
                  </p>
                )}
                {resultado.inserted > 0 && (
                  <p>
                    ✓ {resultado.inserted}{" "}
                    {resultado.inserted === 1
                      ? "entrada de estoque registrada"
                      : "entradas de estoque registradas"}
                    .
                  </p>
                )}
                {resultado.semEstoque > 0 && (
                  <p>
                    {resultado.semEstoque}{" "}
                    {resultado.semEstoque === 1
                      ? "item ficou só no catálogo (saldo 0, sem entrada de estoque)."
                      : "itens ficaram só no catálogo (saldo 0, sem entrada de estoque)."}
                  </p>
                )}
              </div>
            )}

            {resultado.falhas.length > 0 && (
              <div className="space-y-1.5 rounded-lg bg-danger-bg px-3.5 py-3">
                <p className="text-[13px] font-semibold text-danger-text">
                  {resultado.falhas.length}{" "}
                  {resultado.falhas.length === 1
                    ? "linha não foi importada"
                    : "linhas não foram importadas"}
                  :
                </p>
                <ul className="max-h-40 space-y-0.5 overflow-y-auto text-[12.5px] text-danger-text">
                  {resultado.falhas.map((f) => (
                    <li key={`${f.linha}-${f.epiNome}`}>
                      Linha {f.linha} ({f.epiNome || "—"}): {f.erro}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : step === "upload" ? (
          <div className="space-y-4">
            <p className="text-[13.5px] text-text-secondary">
              Envie uma planilha com EPI, Tipo, C.A., Validade do C.A.,
              Tamanho, Custo unitário e Saldo — ela alimenta o catálogo de EPI
              e o estoque inicial ao mesmo tempo, sem precisar das duas
              importações separadas. Tipo é opcional, mas se a planilha tiver
              essa coluna ela já aparece selecionada sozinha na próxima etapa.
            </p>

            <p className="rounded-lg bg-surface-muted px-3.5 py-2.5 text-[12.5px] text-text-secondary">
              Um EPI que ainda não existe no catálogo é criado
              automaticamente — não precisa importar &ldquo;EPIs
              homologados&rdquo; antes. Tamanhos diferentes do mesmo modelo
              (ex.: calçado 38, 39, 40) viram itens separados no catálogo;
              repita o mesmo C.A. em cada linha, se for o caso.
            </p>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-strong px-4 py-8 text-center transition hover:border-brand-500 hover:bg-brand-50">
              <span className="text-[13.5px] font-semibold text-brand-700">
                Clique para escolher o arquivo
              </span>
              <span className="text-[12px] text-text-muted">
                .xlsx, .xls ou .csv
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>

            {fileName && !parseError && (
              <p className="text-[12.5px] text-text-muted">
                Lendo <span className="font-medium">{fileName}</span>…
              </p>
            )}

            {parseError && (
              <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
                {parseError}
              </p>
            )}
          </div>
        ) : step === "mapear" ? (
          <div className="space-y-4">
            <p className="text-[13.5px] text-text-secondary">
              Encontramos <span className="font-semibold">{rawRows.length}</span>{" "}
              linhas em <span className="font-medium">{fileName}</span>.
              Indique qual coluna da sua planilha corresponde a cada campo.
            </p>

            <div className="space-y-3">
              {(Object.keys(FIELD_LABEL) as FieldKey[]).map((field) => (
                <div key={field} className="grid grid-cols-3 items-center gap-3">
                  <label className="text-[13px] font-semibold text-text-secondary">
                    {FIELD_LABEL[field]}
                    {CAMPOS_OBRIGATORIOS.includes(field) && (
                      <span className="text-danger-text"> *</span>
                    )}
                  </label>
                  <select
                    value={mapping[field]}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [field]: e.target.value }))
                    }
                    className="col-span-2 w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2 text-[13px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">— não mapear —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-1">
              <button
                type="button"
                onClick={resetAll}
                className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
              >
                ← Trocar arquivo
              </button>
              <button
                type="button"
                disabled={
                  !mapping.epi || !mapping.custo_unitario || !mapping.saldo
                }
                onClick={() => setStep("revisar")}
                className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[12px] font-semibold text-brand-700">
                {validRows.length} prontas para importar
              </span>
              {novosNoCatalogo > 0 && (
                <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[12px] font-semibold text-brand-700">
                  {novosNoCatalogo} nova{novosNoCatalogo === 1 ? "" : "s"} no
                  catálogo
                </span>
              )}
              {errorRows.length > 0 && (
                <span className="rounded-full bg-danger-bg px-2.5 py-1 text-[12px] font-semibold text-danger-text">
                  {errorRows.length} com erro (serão ignoradas)
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-border-subtle">
              <table className="w-full border-collapse text-left text-[12.5px]">
                <thead className="sticky top-0 bg-brand-50">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-text-secondary">
                      EPI
                    </th>
                    <th className="px-3 py-2 font-semibold text-text-secondary">
                      Tipo
                    </th>
                    <th className="px-3 py-2 font-semibold text-text-secondary">
                      Custo unit.
                    </th>
                    <th className="px-3 py-2 font-semibold text-text-secondary">
                      Saldo
                    </th>
                    <th className="px-3 py-2 font-semibold text-text-secondary">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedRows.map((r) => (
                    <tr key={r.linha} className="border-t border-border-subtle">
                      <td className="px-3 py-2 text-foreground">
                        {r.nomeFinal || "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {r.tipo || "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {r.custoUnitario ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {r.saldo ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {(() => {
                          const { texto, className } = statusLinha(r);
                          return <span className={className}>{texto}</span>;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {submitError && (
              <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
                {submitError}
              </p>
            )}

            <div className="flex justify-between pt-1">
              <button
                type="button"
                onClick={() => setStep("mapear")}
                className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Ajustar mapeamento
              </button>
              <button
                type="button"
                disabled={pending || validRows.length === 0}
                onClick={handleConfirmar}
                className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending
                  ? "Importando..."
                  : `Importar ${validRows.length} linha${
                      validRows.length === 1 ? "" : "s"
                    }`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
