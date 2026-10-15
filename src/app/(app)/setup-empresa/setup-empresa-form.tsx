"use client";

import { useActionState, useState } from "react";
import { criarEmpresa, type CriarEmpresaState } from "./actions";
import {
  PLANO_LABEL,
  PLANO_VALOR_MENSAL,
  PLANOS_ORDENADOS,
  TAXA_IMPLANTACAO,
  formatValorPlano,
} from "@/lib/data/planos";

const initialState: CriarEmpresaState = { error: null };

const inputClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3.5 py-3 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const labelClass =
  "mb-1.5 block text-[12.5px] font-semibold text-text-secondary";

export function SetupEmpresaForm() {
  const [state, formAction, pending] = useActionState(
    criarEmpresa,
    initialState,
  );
  // "interno" (fora de PlanoAssinatura) é o único valor que pula a
  // criação de assinatura no Asaas — ver mesmo texto em actions.ts.
  const [plano, setPlano] = useState<string>("interno");
  const comercial = plano !== "interno";

  if (state.success) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-brand-50 px-4 py-3.5 text-sm text-brand-800">
          Empresa e usuário admin criados com sucesso. O novo cliente já pode
          entrar em <strong>/login</strong> com o e-mail e senha cadastrados.
        </div>
        {state.avisoImplantacao && (
          <div className="rounded-lg bg-warning-bg px-4 py-3.5 text-sm text-warning-text">
            {state.avisoImplantacao}
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <fieldset className="space-y-4">
        <legend className="mb-1 text-[13px] font-bold text-foreground">
          Dados da empresa
        </legend>

        <div>
          <label htmlFor="empresaNome" className={labelClass}>
            Nome da empresa
          </label>
          <input
            id="empresaNome"
            name="empresaNome"
            type="text"
            required
            placeholder="ViniPlast Indústria Ltda"
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cnpj" className={labelClass}>
              CNPJ{comercial && <span className="text-danger-text"> *</span>}
            </label>
            <input
              id="cnpj"
              name="cnpj"
              type="text"
              required={comercial}
              placeholder="00.000.000/0000-00"
              className={inputClass}
            />
            {comercial && (
              <p className="mt-1 text-[11.5px] text-text-muted">
                Obrigatório para plano pago — o Asaas precisa dele para gerar a cobrança.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="endereco" className={labelClass}>
              Endereço
            </label>
            <input
              id="endereco"
              name="endereco"
              type="text"
              placeholder="Rua, número, cidade - UF"
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-border-subtle pt-4">
        <legend className="mb-1 text-[13px] font-bold text-foreground">
          Usuário admin da empresa
        </legend>

        <div>
          <label htmlFor="adminNome" className={labelClass}>
            Nome do usuário
          </label>
          <input
            id="adminNome"
            name="adminNome"
            type="text"
            required
            placeholder="Nome completo"
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className={labelClass}>
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="off"
              require
