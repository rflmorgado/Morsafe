"use client";

import { useActionState } from "react";
import { criarEmpresa, type CriarEmpresaState } from "./actions";

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

  if (state.success) {
    return (
      <div className="rounded-lg bg-brand-50 px-4 py-3.5 text-sm text-brand-800">
        Empresa e usuário admin criados com sucesso. A sessão foi encerrada —
        o novo cliente já pode entrar em <strong>/login</strong> com o e-mail
        e senha cadastrados.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
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
              CNPJ
            </label>
            <input
              id="cnpj"
              name="cnpj"
              type="text"
              placeholder="00.000.000/0000-00"
              className={inputClass}
            />
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
            placeholder="Rafael Morgado"
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
              required
              placeholder="admin@empresa.com.br"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="senha" className={labelClass}>
              Senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="••••••••••"
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-t border-border-subtle pt-4">
        <label htmlFor="senhaAcesso" className={labelClass}>
          Senha de acesso a esta ferramenta
        </label>
        <input
          id="senhaAcesso"
          name="senhaAcesso"
          type="password"
          autoComplete="off"
          required
          placeholder="••••••••••"
          className={inputClass}
        />
      </fieldset>

      {state.error && (
        <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Criando..." : "Criar empresa e usuário admin"}
      </button>
    </form>
  );
}
