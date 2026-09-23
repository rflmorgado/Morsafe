"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Modal } from "@/components/ui/modal";
import { importarColaboradores, createSetor, createCargo } from "./actions";
import type { SetorComCargos } from "@/lib/data/setores";

type RawRow = Record<string, unknown>;

type FieldKey =
  | "nome"
  | "setor"
  | "cargo"
  | "cpf"
  | "telefone"
  | "integracao";

const FIELD_LABEL: Record<FieldKey, string> = {
  nome: "Nome",
  setor: "Setor",
  cargo: "Cargo",
  cpf: "CPF",
  telefone: "Telefone",
  integracao: "Integração de Segurança / Treinamento NR-06",
};

const GUESS_KEYWORDS: Record<FieldKey, string[]> = {
  nome: ["nome", "name", "colaborador", "funcionario"],
  setor: ["setor", "sector", "departamento", "department", "area"],
  cargo: ["cargo", "funcao", "role", "position"],
  cpf: ["cpf"],
  telefone: ["telefone", "fone", "celular", "phone", "contato"],
  integracao: ["integracao", "nr06", "nr-06", "nr 06", "treinamento"],
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Converte o valor de uma célula de data numa string ISO (yyyy-mm-dd), ou
 * null se não der pra reconhecer o formato — usado só pra Integração de
 * Segurança/NR-06, que é opcional, então uma data não reconhecida vira "sem
 * data" em vez de travar a importação da linha inteira. Aceita:
 * - Date (quando a planilha lê a célula como data de verdade, ver
 *   `cellDates: true` no XLSX.read abaixo);
 * - "dd/mm/aaaa" ou "dd-mm-aaaa" (formato comum no Brasil);
 * - "aaaa-mm-dd" (ISO, caso a coluna já venha assim).
 */
function parseDataFlexivel(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (typeof value === "string") {
    const texto = value.trim();
    if (!texto) return null;

    const br = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (br) {
      const [, dd, mm, yyyy] = br;
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }

    const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const [, yyyy, mm, dd] = iso;
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
  }

  return null;
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
  dataIntegracaoSeguranca: string | null;
  // Valor bruto da célula de Integração/NR-06 antes do parse, só pra
  // distinguir na revisão "coluna vazia" de "tinha algo mas não reconheci o
  // formato" — o segundo caso vira um aviso, não erro, mas vale mostrar.
  integracaoBruta: string;
  erro: string | null;
};

type Step = "upload" | "mapear" | "revisar";

/**
 * Texto e cor mostrados na coluna Status da revisão. Erro de verdade (nome,
 * setor ou cargo vazio) continua vermelho e a linha é ignorada; setor/cargo
 * que serão criados na hora aparecem em amarelo, como aviso — não impedem
 * a importação.
 */
function statusLinha(r: ResolvedRow): { texto: string; className: string } {
  if (r.erro) {
    return { texto: r.erro, className: "text-danger-text" };
  }
  if (!r.setorId && !r.cargoId) {
    return {
      texto: "✓ vai criar setor e função novos",
      className: "text-warning-text",
    };
  }
  if (!r.setorId) {
    return { texto: "✓ vai criar setor novo", className: "text-warning-text" };
  }
  if (!r.cargoId) {
    return { texto: "✓ vai criar função nova", className: "text-warning-text" };
  }
  return { texto: "✓ OK", className: "text-brand-700" };
}

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
    integracao: "",
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
    setMapping({
      nome: "",
      setor: "",
      cargo: "",
      cpf: "",
      telefone: "",
      integracao: "",
    });
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
      // cellDates: true faz células de data virarem objetos Date de verdade
      // (em vez de número serial do Excel) — só afeta a leitura da coluna de
      // Integração de Segurança/NR-06, ver parseDataFlexivel acima.
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
        setor: guessColumn(detectedHeaders, "setor"),
        cargo: guessColumn(detectedHeaders, "cargo"),
        cpf: guessColumn(detectedHeaders, "cpf"),
        telefone: guessColumn(detectedHeaders, "telefone"),
        integracao: guessColumn(detectedHeaders, "integracao"),
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
      const integracaoBruta = mapping.integracao
        ? String(row[mapping.integracao] ?? "").trim()
        : "";
      const dataIntegracaoSeguranca = mapping.integracao
        ? parseDataFlexivel(row[mapping.integracao])
        : null;

      let erro: string | null = null;
      let setorId: string | null = null;
      let cargoId: string | null = null;

      // Setor/cargo que não batem com nada já cadastrado não são mais erro
      // — ficam com id nulo aqui, e são criados automaticamente na
      // confirmação (mesma ideia da opção "Outro" do cadastro manual).
      // Só nome, setor e cargo vazios continuam sendo erro de verdade,
      // porque não dá pra criar um setor ou função sem nome.
      if (!nome) {
        erro = "Nome vazio";
      } else if (!setorNome) {
        erro = "Setor vazio";
      } else if (!cargoNome) {
        erro = "Cargo vazio";
      } else {
        const setor = setores.find(
          (s) => normalize(s.nome) === normalize(setorNome),
        );
        if (setor) {
          setorId = setor.id;
          const cargo = setor.cargos.find(
            (c) => normalize(c.nome) === normalize(cargoNome),
          );
          if (cargo) {
            cargoId = cargo.id;
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
        dataIntegracaoSeguranca,
        integracaoBruta,
        erro,
      };
    });
  }, [step, rawRows, mapping, setores]);

  const validRows = resolvedRows.filter((r) => r.erro === null);
  const errorRows = resolvedRows.filter((r) => r.erro !== null);
  const criandoRows = validRows.filter((r) => !r.setorId || !r.cargoId);

  function handleConfirmar() {
    setSubmitError(null);
    startTransition(async () => {
      // Setor/cargo que não bateram com nada já cadastrado (setorId/cargoId
      // nulos) são criados agora, um de cada nome distinto — se 5 linhas da
      // planilha citam o mesmo setor novo "TI", só cria um "TI" e reaproveita
      // o id nas outras 4, em vez de criar 5 setores duplicados.
      const novosSetores = new Map<string, string>(); // nome normalizado -> id

      for (const r of validRows) {
        if (r.setorId) continue;
        const chave = normalize(r.setorNome);
        if (novosSetores.has(chave)) continue;
        const resultado = await createSetor(r.setorNome);
        if (resultado.error || !resultado.id) {
          setSubmitError(
            `Não foi possível criar o setor "${r.setorNome}": ${resultado.error ?? "erro desconhecido"}`,
          );
          return;
        }
        novosSetores.set(chave, resultado.id);
      }

      const novosCargos = new Map<string, string>(); // `${setorId}::nome normalizado` -> id
      const linhasResolvidas: {
        nome: string;
        setorId: string;
        cargoId: string;
        cpf: string | null;
        telefone: string | null;
        dataIntegracaoSeguranca: string | null;
      }[] = [];

      for (const r of validRows) {
        const finalSetorId = r.setorId ?? novosSetores.get(normalize(r.setorNome))!;
        let finalCargoId = r.cargoId;

        if (!finalCargoId) {
          const chaveCargo = `${finalSetorId}::${normalize(r.cargoNome)}`;
          const existente = novosCargos.get(chaveCargo);
          if (existente) {
            finalCargoId = existente;
          } else {
            const resultado = await createCargo(finalSetorId, r.cargoNome);
            if (resultado.error || !resultado.id) {
              setSubmitError(
                `Não foi possível criar a função "${r.cargoNome}": ${resultado.error ?? "erro desconhecido"}`,
              );
              return;
            }
            finalCargoId = resultado.id;
            novosCargos.set(chaveCargo, finalCargoId);
          }
        }

        linhasResolvidas.push({
          nome: r.nome,
          setorId: finalSetorId,
          cargoId: finalCargoId,
          cpf: r.cpf || null,
          telefone: r.telefone || null,
          dataIntegracaoSeguranca: r.dataIntegracaoSeguranca,
        });
      }

      const result = await importarColaboradores(linhasResolvidas);

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
              {criandoRows.length > 0 && (
                <span className="rounded-full bg-warning-bg px-2.5 py-1 text-[12px] font-semibold text-warning-text">
                  {criandoRows.length} vão criar setor/função novos
                </span>
              )}
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
                    {mapping.integracao && (
                      <th className="px-3 py-2 font-semibold text-text-secondary">
                        Integração/NR-06
                      </th>
                    )}
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
                      {mapping.integracao && (
                        <td className="px-3 py-2">
                          {r.dataIntegracaoSeguranca ? (
                            <span className="text-foreground">
                              {new Date(
                                r.dataIntegracaoSeguranca + "T00:00:00",
                              ).toLocaleDateString("pt-BR")}
                            </span>
                          ) : r.integracaoBruta ? (
                            <span className="text-warning-text">
                              data não reconhecida
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                      )}
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
