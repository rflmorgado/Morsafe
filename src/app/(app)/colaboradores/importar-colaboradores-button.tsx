"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Modal } from "@/components/ui/modal";
import { importarColaboradores } from "./actions";
import type { SetorComCargos } from "@/lib/data/setores";

type RawRow = Record<string, unknown>;

type FieldKey = "nome" | "setor" | "cargo" | "cpf" | "telefone";

const FIELD_LABEL: Record<FieldKey, string> = {
  nome: "Nome",
  setor: "Setor",
  cargo: "Cargo",
  cpf: "CPF",
  telefone: "Telefone",
};

const GUESS_KEYWORDS: Record<FieldKey, string[]> = {
  nome: ["nome", "name", "colaborador", "funcionario"],
  setor: ["setor", "sector", "departamento", "department", "area"],
  cargo: ["cargo", "funcao", "role", "position"],
  cpf: ["cpf"],
  telefone: ["telefone", "fone", "celular", "phone", "contato"],
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

type ResolvedRow = {
  linha: number;
  nome: string;
  setorNome: string;
  cargoNome: string;
  setorId: string | null;
  cargoId: string | null;
  cpf: string;
  telefone: string;
  erro: string | null;
};

type Step = "upload" | "mapear" | "revisar";

export function ImportarColaboradoresButton({
  setores,
}: {
  setores: SetorComCargos[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    nome: "",
    setor: "",
    cargo: "",
    cpf: "",
    telefone: "",
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function resetAll() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({ nome: "", setor: "", cargo: "", cpf: "", telefone: "" });
    setParseError(null);
    setSubmitError(null);
    setSuccessCount(null);
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
      const workbook = XLSX.read(buffer, { type: "array" });
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
        setor: guessColumn(detectedHeaders, "setor"),
        cargo: guessColumn(detectedHeaders, "cargo"),
        cpf: guessColumn(detectedHeaders, "cpf"),
        telefone: guessColumn(detectedHeaders, "telefone"),
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
      const nome = String(row[mapping.nome] ?? "").trim();
      const setorNome = mapping.setor
        ? String(row[mapping.setor] ?? "").trim()
        : "";
      const cargoNome = mapping.cargo
        ? String(row[mapping.cargo] ?? "").trim()
        : "";
      const cpf = mapping.cpf ? String(row[mapping.cpf] ?? "").trim() : "";
      const telefone = mapping.telefone
        ? String(row[mapping.telefone] ?? "").trim()
        : "";

      let erro: string | null = null;
      let setorId: string | null = null;
      let cargoId: string | null = null;

      if (!nome) {
        erro = "Nome vazio";
      } else if (!setorNome) {
        erro = "Setor vazio";
      } else {
        const setor = setores.find(
          (s) => normalize(s.nome) === normalize(setorNome),
        );
        if (!setor) {
          erro = `Setor "${setorNome}" não encontrado`;
        } else {
          setorId = setor.id;
          if (!cargoNome) {
            erro = "Cargo vazio";
          } else {
            const cargo = setor.cargos.find(
              (c) => normalize(c.nome) === normalize(cargoNome),
            );
            if (!cargo) {
              erro = `Cargo "${cargoNome}" não encontrado no setor "${setor.nome}"`;
            } else {
              cargoId = cargo.id;
            }
          }
        }
      }

      return {
        linha: i + 2, // +2: cabeçalho é a linha 1 da planilha
        nome,
        setorNome,
        cargoNome,
        setorId,
        cargoId,
        cpf,
        telefone,
        erro,
      };
    });
  }, [step, rawRows, mapping, setores]);

  const validRows = resolvedRows.filter((r) => r.erro === null);
  const errorRows = resolvedRows.filter((r) => r.erro !== null);

  function handleConfirmar() {
    setSubmitError(null);
    startTransition(async () => {
      const result = await importarColaboradores(
        validRows.map((r) => ({
          nome: r.nome,
          setorId: r.setorId as string,
          cargoId: r.cargoId as string,
          cpf: r.cpf || null,
          telefone: r.telefone || null,
        })),
      );

      if (result.error) {
        setSubmitError(result.error);
        return;
      }

      setSuccessCount(result.inserted ?? validRows.length);
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

      <Modal open={open} onClose={handleClose} title="Importar colaboradores">
        {successCount !== null ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[13.5px] font-medium text-brand-700">
              ✓ {successCount}{" "}
              {successCount === 1
                ? "colaborador importado"
                : "colaboradores importados"}{" "}
              com sucesso.
            </p>
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
              Envie a planilha que você já tem (Excel ou CSV) com a lista de
              colaboradores. Não precisa seguir nenhum modelo — na próxima
              etapa você indica qual coluna é qual.
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
                    {(field === "nome" || field === "setor" || field === "cargo") && (
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
                disabled={!mapping.nome || !mapping.setor || !mapping.cargo}
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
                      Nome
                    </th>
                    <th className="px-3 py-2 font-semibold text-text-secondary">
                      Setor
                    </th>
                    <th className="px-3 py-2 font-semibold text-text-secondary">
                      Cargo
                    </th>
                    <th className="px-3 py-2 font-semibold text-text-secondary">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedRows.map((r) => (
                    <tr
                      key={r.linha}
                      className="border-t border-border-subtle"
                    >
                      <td className="px-3 py-2 text-foreground">
                        {r.nome || "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {r.setorNome || "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {r.cargoNome || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.erro ? (
                          <span className="text-danger-text">{r.erro}</span>
                        ) : (
                          <span className="text-brand-700">✓ OK</span>
                        )}
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
                  : `Importar ${validRows.length} colaborador${
                      validRows.length === 1 ? "" : "es"
                    }`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
