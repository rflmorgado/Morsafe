"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Modal } from "@/components/ui/modal";
import { importarEpis, type ImportarEpiFalha } from "./actions";

type RawRow = Record<string, unknown>;

type FieldKey =
  | "nome"
  | "tipo"
  | "ca"
  | "ca_validade"
  | "custo_medio_atual"
  | "fornecedor"
  | "vida_util_dias";

const FIELD_LABEL: Record<FieldKey, string> = {
  nome: "Nome do EPI",
  tipo: "Tipo",
  ca: "Número do C.A.",
  ca_validade: "Validade do C.A.",
  custo_medio_atual: "Custo médio",
  fornecedor: "Fornecedor",
  vida_util_dias: "Vida útil (dias)",
};

const GUESS_KEYWORDS: Record<FieldKey, string[]> = {
  nome: ["nome", "epi", "equipamento", "descricao", "descrição", "name"],
  tipo: ["tipo", "categoria", "type"],
  ca: ["ca", "c.a", "certificado"],
  ca_validade: ["validade", "vencimento", "expira"],
  custo_medio_atual: ["custo", "preco", "preço", "valor"],
  fornecedor: ["fornecedor", "marca", "supplier"],
  vida_util_dias: ["vida util", "vida útil", "dias", "durabilidade"],
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
 * Converte a célula de validade do C.A. pra "YYYY-MM-DD": aceita Date
 * (quando o Excel já traz a célula como data — por isso lemos o arquivo com
 * cellDates: true), "DD/MM/AAAA" e "AAAA-MM-DD". Formato não reconhecido
 * devolve null, tratado como aviso e não como erro — a validade é opcional.
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
  nome: string;
  tipo: string;
  ca: string;
  caValidade: string | null;
  custoMedioAtual: number | null;
  fornecedor: string;
  vidaUtilDias: number | null;
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
 * Importação em massa do catálogo de EPI, mesmo fluxo de 3 passos usado em
 * colaboradores (upload → mapear colunas → revisar e confirmar). Mais simples
 * que colaboradores porque "tipo" não é uma tabela separada (não existe
 * setor/cargo pra resolver ou criar no meio do caminho) — todo o trabalho é
 * ler a planilha e validar/formatar os valores antes de mandar pro servidor.
 */
export function ImportarEpisButton() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    nome: "",
    tipo: "",
    ca: "",
    ca_validade: "",
    custo_medio_atual: "",
    fornecedor: "",
    vida_util_dias: "",
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [falhas, setFalhas] = useState<ImportarEpiFalha[]>([]);
  const [pending, startTransition] = useTransition();

  function resetAll() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({
      nome: "",
      tipo: "",
      ca: "",
      ca_validade: "",
      custo_medio_atual: "",
      fornecedor: "",
      vida_util_dias: "",
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
        nome: guessColumn(detectedHeaders, "nome"),
        tipo: guessColumn(detectedHeaders, "tipo"),
        ca: guessColumn(detectedHeaders, "ca"),
        ca_validade: guessColumn(detectedHeaders, "ca_validade"),
        custo_medio_atual: guessColumn(detectedHeaders, "custo_medio_atual"),
        fornecedor: guessColumn(detectedHeaders, "fornecedor"),
        vida_util_dias: guessColumn(detectedHeaders, "vida_util_dias"),
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
      const nome = mapping.nome ? String(row[mapping.nome] ?? "").trim() : "";
      const tipo = mapping.tipo ? String(row[mapping.tipo] ?? "").trim() : "";
      const ca = mapping.ca ? String(row[mapping.ca] ?? "").trim() : "";
      const fornecedor = mapping.fornecedor
        ? String(row[mapping.fornecedor] ?? "").trim()
        : "";

      let erro: string | null = null;
      let aviso: string | null = null;

      if (!nome) {
        erro = "Nome vazio";
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

      const custoCell = mapping.custo_medio_atual
        ? row[mapping.custo_medio_atual]
        : "";
      const temCustoCell = String(custoCell ?? "").trim() !== "";
      const custoMedioAtual = temCustoCell
        ? parseNumeroPlanilha(custoCell)
        : null;
      if (temCustoCell && custoMedioAtual === null && !erro && !aviso) {
        aviso = "Custo médio não reconhecido (ficará 0)";
      }

      const vidaUtilCell = mapping.vida_util_dias
        ? row[mapping.vida_util_dias]
        : "";
      const temVidaUtilCell = String(vidaUtilCell ?? "").trim() !== "";
      const vidaUtilDias = temVidaUtilCell
        ? parseNumeroPlanilha(vidaUtilCell)
        : null;
      if (temVidaUtilCell && vidaUtilDias === null && !erro && !aviso) {
        aviso = "Vida útil não reconhecida (ficará em branco)";
      }

      return {
        linha: i + 2, // +2: cabeçalho é a linha 1 da planilha
        nome,
        tipo,
        ca,
        caValidade,
        custoMedioAtual,
        fornecedor,
        vidaUtilDias,
        erro,
        aviso,
      };
    });
  }, [step, rawRows, mapping]);

  const validRows = resolvedRows.filter((r) => r.erro === null);
  const errorRows = resolvedRows.filter((r) => r.erro !== null);

  function handleConfirmar() {
    setSubmitError(null);
    startTransition(async () => {
      const payload = validRows.map((r) => ({
        linha: r.linha,
        nome: r.nome,
        tipo: r.tipo || null,
        exigeCa: !!r.ca,
        ca: r.ca || null,
        caValidade: r.caValidade,
        custoMedioAtual: r.custoMedioAtual ?? 0,
        fornecedor: r.fornecedor || null,
        vidaUtilDias: r.vidaUtilDias,
      }));

      const result = await importarEpis(payload);

      if (result.error) {
        setSubmitError(result.error);
        return;
      }

      // Mesmo quando algumas linhas falham (ex: C.A./validade inconsistente
      // com a constraint do banco — ver comentário em importarEpis), as
      // outras já foram salvas: por isso isso não é tratado como
      // result.error, e sim mostrado como sucesso parcial na tela seguinte,
      // com a lista de quais linhas ficaram de fora e por quê.
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
        ⇪ Importar planilha
      </button>

      <Modal open={open} onClose={handleClose} title="Importar EPIs">
        {successCount !== null ? (
          <div className="space-y-4">
            {successCount > 0 && (
              <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[13.5px] font-medium text-brand-700">
                ✓ {successCount}{" "}
                {successCount === 1 ? "EPI importado" : "EPIs importados"} com
                sucesso.
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
                      Linha {f.linha} ({f.nome || "—"}): {f.erro}
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
              Envie a planilha que você já tem (Excel ou CSV) com o catálogo
              de EPI. Não precisa seguir nenhum modelo — na próxima etapa você
              indica qual coluna é qual.
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
                    {field === "nome" && (
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
                disabled={!mapping.nome}
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
                {validRows.length} prontos para importar
              </span>
              {errorRows.length > 0 && (
                <span className="rounded-full bg-danger-bg px-2.5 py-1 text-[12px] font-semibold text-danger-text">
                  {errorRows.length} com erro (serão ignorados)
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
                      C.A.
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
                        {r.nome || "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {r.tipo || "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {r.ca || "—"}
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
                  : `Importar ${validRows.length} EPI${
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
