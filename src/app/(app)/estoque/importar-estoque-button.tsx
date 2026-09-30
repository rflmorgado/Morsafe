"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Modal } from "@/components/ui/modal";
import {
  importarEntradasEstoque,
  type ImportarEntradaEstoqueFalha,
} from "./actions";
import type { EpiAtivo } from "@/lib/data/movimentacoes";

type RawRow = Record<string, unknown>;

type FieldKey =
  | "epi"
  | "quantidade"
  | "preco_unitario"
  | "fornecedor"
  | "nota_fiscal"
  | "data_compra";

const FIELD_LABEL: Record<FieldKey, string> = {
  epi: "EPI",
  quantidade: "Quantidade",
  preco_unitario: "Preço unitário",
  fornecedor: "Fornecedor",
  nota_fiscal: "Nota fiscal",
  data_compra: "Data da compra",
};

const GUESS_KEYWORDS: Record<FieldKey, string[]> = {
  epi: ["epi", "equipamento", "nome", "descricao", "descrição", "item"],
  quantidade: ["quantidade", "qtd", "qty", "quant"],
  preco_unitario: ["preco", "preço", "valor", "unitario", "unitário", "custo"],
  fornecedor: ["fornecedor", "marca", "supplier"],
  nota_fiscal: ["nota", "nf", "fiscal", "invoice"],
  data_compra: ["data", "compra", "emissao", "emissão", "date"],
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
 * Mesmo parser de data flexível de importar-epis-button.tsx (Date, "DD/MM/
 * AAAA" ou "AAAA-MM-DD") — duplicado aqui de propósito, não extraído pra um
 * util compartilhado: mesmo padrão já usado entre os botões de importação
 * deste projeto (cada um com sua cópia pequena, sem uma dependência extra
 * entre telas que nada mais liga).
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
  epiNome: string;
  epiId: string | null;
  quantidade: number | null;
  precoUnitario: number | null;
  fornecedor: string;
  notaFiscal: string;
  dataCompra: string | null;
  dataCompraBruta: string;
  erro: string | null;
  aviso: string | null;
};

type Step = "upload" | "mapear" | "revisar";

function statusLinha(r: ResolvedRow): { texto: string; className: string } {
  if (r.erro) {
    return { texto: r.erro, className: "text-danger-text" };
  }
  if (r.aviso) {
    return { texto: r.aviso, className: "text-warning-text" };
  }
  return { texto: "✓ OK", className: "text-brand-700" };
}

/**
 * Importação em massa de entradas de estoque, mesmo fluxo de 3 passos dos
 * outros dois botões de importação (EPIs, colaboradores) — pensada pro
 * onboarding de uma empresa nova: em vez de lançar item por item, a
 * planilha que a empresa já tem vira o lote inicial de compras.
 *
 * Diferente de colaboradores (que cria setor/cargo na hora), aqui o EPI de
 * cada linha PRECISA já estar no catálogo — resolvido contra `epis`
 * (mesma lista usada no formulário de "Registrar entrada de estoque"), sem
 * criar EPI novo no meio do caminho. Por isso o aviso de que o catálogo
 * precisa ser importado primeiro.
 */
export function ImportarEstoqueButton({ epis }: { epis: EpiAtivo[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    epi: "",
    quantidade: "",
    preco_unitario: "",
    fornecedor: "",
    nota_fiscal: "",
    data_compra: "",
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [falhas, setFalhas] = useState<ImportarEntradaEstoqueFalha[]>([]);
  const [pending, startTransition] = useTransition();

  function resetAll() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({
      epi: "",
      quantidade: "",
      preco_unitario: "",
      fornecedor: "",
      nota_fiscal: "",
      data_compra: "",
    });
    setParseError(null);
    setSubmitError(null);
    setSuccessCount(null);
    setFalhas([]);
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
        quantidade: guessColumn(detectedHeaders, "quantidade"),
        preco_unitario: guessColumn(detectedHeaders, "preco_unitario"),
        fornecedor: guessColumn(detectedHeaders, "fornecedor"),
        nota_fiscal: guessColumn(detectedHeaders, "nota_fiscal"),
        data_compra: guessColumn(detectedHeaders, "data_compra"),
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
      const epiNome = mapping.epi ? String(row[mapping.epi] ?? "").trim() : "";
      const fornecedor = mapping.fornecedor
        ? String(row[mapping.fornecedor] ?? "").trim()
        : "";
      const notaFiscal = mapping.nota_fiscal
        ? String(row[mapping.nota_fiscal] ?? "").trim()
        : "";

      let erro: string | null = null;
      let aviso: string | null = null;

      const epi = epiNome
        ? epis.find((e) => normalize(e.nome) === normalize(epiNome))
        : undefined;

      if (!epiNome) {
        erro = "EPI vazio";
      } else if (!epi) {
        erro = "EPI não encontrado no catálogo";
      }

      const quantidadeCell = mapping.quantidade ? row[mapping.quantidade] : "";
      const quantidadeBruta = parseNumeroPlanilha(quantidadeCell);
      const quantidade =
        quantidadeBruta !== null && quantidadeBruta > 0
          ? Math.round(quantidadeBruta)
          : null;
      if (!erro && quantidade === null) {
        erro = "Quantidade inválida";
      }

      const precoCell = mapping.preco_unitario ? row[mapping.preco_unitario] : "";
      const precoUnitario = parseNumeroPlanilha(precoCell);
      if (!erro && (precoUnitario === null || precoUnitario < 0)) {
        erro = "Preço unitário inválido";
      }

      const dataCompraCell = mapping.data_compra ? row[mapping.data_compra] : "";
      const dataCompraBruta =
        dataCompraCell instanceof Date
          ? dataCompraCell.toLocaleDateString("pt-BR")
          : String(dataCompraCell ?? "").trim();
      const temDataCompraCell =
        dataCompraCell instanceof Date || dataCompraBruta !== "";
      const dataCompra = temDataCompraCell
        ? parseDataPlanilha(dataCompraCell)
        : null;
      if (temDataCompraCell && !dataCompra && !erro) {
        aviso = "Data da compra não reconhecida (usará a data de hoje)";
      }

      return {
        linha: i + 2, // +2: cabeçalho é a linha 1 da planilha
        epiNome,
        epiId: epi?.id ?? null,
        quantidade,
        precoUnitario,
        fornecedor,
        notaFiscal,
        dataCompra,
        dataCompraBruta,
        erro,
        aviso,
      };
    });
  }, [step, rawRows, mapping, epis]);

  const validRows = resolvedRows.filter((r) => r.erro === null);
  const errorRows = resolvedRows.filter((r) => r.erro !== null);

  function handleConfirmar() {
    setSubmitError(null);
    startTransition(async () => {
      const payload = validRows.map((r) => ({
        linha: r.linha,
        epiId: r.epiId!,
        epiNome: r.epiNome,
        quantidade: r.quantidade!,
        precoUnitario: r.precoUnitario!,
        fornecedor: r.fornecedor || null,
        notaFiscal: r.notaFiscal || null,
        dataCompra: r.dataCompra,
      }));

      const result = await importarEntradasEstoque(payload);

      if (result.error) {
        setSubmitError(result.error);
        return;
      }

      // Mesmo quando algumas linhas falham (ex: EPI desativado entre a
      // revisão e a confirmação), as outras já foram salvas — sucesso
      // parcial, mostrado na tela seguinte com a lista de quem ficou de
      // fora e por quê (mesmo padrão de importarEpis/importarColaboradores).
      setSuccessCount(result.inserted ?? 0);
      setFalhas(result.falhas ?? []);
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
        ⇪ Importar estoque inicial
      </button>

      <Modal open={open} onClose={handleClose} title="Importar estoque inicial">
        {successCount !== null ? (
          <div className="space-y-4">
            {successCount > 0 && (
              <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[13.5px] font-medium text-brand-700">
                ✓ {successCount}{" "}
                {successCount === 1
                  ? "entrada de estoque importada"
                  : "entradas de estoque importadas"}{" "}
                com sucesso.
              </p>
            )}

            {falhas.length > 0 && (
              <div className="space-y-1.5 rounded-lg bg-danger-bg px-3.5 py-3">
                <p className="text-[13px] font-semibold text-danger-text">
                  {falhas.length}{" "}
                  {falhas.length === 1
                    ? "linha não foi importada"
                    : "linhas não foram importadas"}
                  :
                </p>
                <ul className="max-h-40 space-y-0.5 overflow-y-auto text-[12.5px] text-danger-text">
                  {falhas.map((f) => (
                    <li key={f.linha}>
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
              Envie a planilha do estoque que a empresa já tem (Excel ou
              CSV). Não precisa seguir nenhum modelo — na próxima etapa você
              indica qual coluna é qual.
            </p>

            <p className="rounded-lg bg-warning-bg px-3.5 py-2.5 text-[12.5px] text-warning-text">
              Cada linha precisa citar um EPI já cadastrado no catálogo — se
              ainda não importou os EPIs dessa empresa, faça isso primeiro
              em &ldquo;EPIs homologados&rdquo;.
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
                    {(field === "epi" ||
                      field === "quantidade" ||
                      field === "preco_unitario") && (
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
                disabled={!mapping.epi || !mapping.quantidade || !mapping.preco_unitario}
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
                      Qtd.
                    </th>
                    <th className="px-3 py-2 font-semibold text-text-secondary">
                      Preço unit.
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
                        {r.epiNome || "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {r.quantidade ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {r.precoUnitario ?? "—"}
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
                className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
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
                  : `Importar ${validRows.length} entrada${
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
