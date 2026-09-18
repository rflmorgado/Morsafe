"use client";

import { useState } from "react";
import { TIPOS_EPI } from "@/lib/data/epi-tipos";

const OUTRO = "__outro__";

export type EpiDefaultValues = {
  nome?: string;
  tipo?: string | null;
  exigeCa?: boolean;
  ca?: string | null;
  caValidade?: string | null;
  vidaUtilDias?: number | null;
  fornecedor?: string | null;
  custoMedioAtual?: number;
};

/**
 * Campos do formulário de EPI, compartilhados entre criar e editar. Ao
 * contrário de Setor/Cargo em colaboradores, "tipo" aqui não é uma tabela
 * separada — é uma coluna de texto simples — então "Outro" só troca o select
 * por um input de texto com o mesmo name="tipo", sem precisar criar nada
 * antes de enviar o formulário.
 */
export function EpiFormFields({
  idPrefix,
  defaultValues,
}: {
  idPrefix: string;
  defaultValues?: EpiDefaultValues;
}) {
  const tipoInicial = defaultValues?.tipo ?? "";
  const tipoEhConhecido =
    !tipoInicial || (TIPOS_EPI as readonly string[]).includes(tipoInicial);

  const [tipoSelecionado, setTipoSelecionado] = useState(
    tipoEhConhecido ? tipoInicial : OUTRO,
  );
  const [exigeCa, setExigeCa] = useState(defaultValues?.exigeCa ?? true);

  const tipoNovo = tipoSelecionado === OUTRO;

  return (
    <>
      <div>
        <label
          htmlFor={`${idPrefix}-nome`}
          className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
        >
          Nome do EPI
        </label>
        <input
          id={`${idPrefix}-nome`}
          name="nome"
          type="text"
          required
          defaultValue={defaultValues?.nome}
          placeholder="Ex.: Protetor auricular plug"
          className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-tipo`}
          className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
        >
          Tipo <span className="font-normal text-text-muted">(opcional)</span>
        </label>
        <select
          id={`${idPrefix}-tipo`}
          value={tipoSelecionado}
          onChange={(e) => setTipoSelecionado(e.target.value)}
          className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        >
          <option value="">Selecione…</option>
          {TIPOS_EPI.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value={OUTRO}>+ Outro (digitar)</option>
        </select>
        {tipoNovo ? (
          <input
            name="tipo"
            type="text"
            required
            defaultValue={tipoEhConhecido ? "" : tipoInicial}
            placeholder="Nome do tipo"
            className="mt-2 w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        ) : (
          <input type="hidden" name="tipo" value={tipoSelecionado} />
        )}
      </div>

      <label className="flex items-center gap-2 text-[13px] font-medium text-foreground">
        <input
          type="checkbox"
          name="exige_ca"
          checked={exigeCa}
          onChange={(e) => setExigeCa(e.target.checked)}
          className="h-4 w-4 rounded border-border-strong text-brand-700 focus:ring-brand-500"
        />
        Exige Certificado de Aprovação (C.A.)
      </label>

      {exigeCa && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`${idPrefix}-ca`}
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Número do C.A.
            </label>
            <input
              id={`${idPrefix}-ca`}
              name="ca"
              type="text"
              required={exigeCa}
              defaultValue={defaultValues?.ca ?? ""}
              placeholder="00000"
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label
              htmlFor={`${idPrefix}-ca_validade`}
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Validade do C.A.{" "}
              <span className="font-normal text-text-muted">(opcional)</span>
            </label>
            <input
              id={`${idPrefix}-ca_validade`}
              name="ca_validade"
              type="date"
              defaultValue={defaultValues?.caValidade ?? ""}
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`${idPrefix}-custo_medio_atual`}
            className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
          >
            Custo médio (R$)
          </label>
          <input
            id={`${idPrefix}-custo_medio_atual`}
            name="custo_medio_atual"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.custoMedioAtual ?? ""}
            placeholder="0,00"
            className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}-fornecedor`}
            className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
          >
            Fornecedor{" "}
            <span className="font-normal text-text-muted">(opcional)</span>
          </label>
          <input
            id={`${idPrefix}-fornecedor`}
            name="fornecedor"
            type="text"
            defaultValue={defaultValues?.fornecedor ?? ""}
            placeholder="Nome do fornecedor"
            className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-vida_util_dias`}
          className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
        >
          Vida útil estimada (dias){" "}
          <span className="font-normal text-text-muted">(opcional)</span>
        </label>
        <input
          id={`${idPrefix}-vida_util_dias`}
          name="vida_util_dias"
          type="number"
          min="1"
          step="1"
          defaultValue={defaultValues?.vidaUtilDias ?? ""}
          placeholder="Ex.: 180"
          className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <p className="mt-1 text-[11.5px] text-text-muted">
          Estimativa interna de planejamento — a NR-06 não fixa um prazo único
          de troca para todo EPI, varia por tipo e orientação do fabricante.
        </p>
      </div>
    </>
  );
}
