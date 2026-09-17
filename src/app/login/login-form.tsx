"use client";

import { useActionState, useState } from "react";
import { login, requestPasswordReset, type LoginState, type ResetPasswordState } from "./actions";

const initialLoginState: LoginState = { error: null };
const initialResetState: ResetPasswordState = { error: null };

const inputClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3.5 py-3 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const labelClass =
  "mb-1.5 block text-[12.5px] font-semibold text-text-secondary";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a17.9 17.9 0 0 1-2.16 3.19m-3.13 2.6A9.99 9.99 0 0 1 12 18c-6.5 0-10-7-10-7a17.7 17.7 0 0 1 4.24-5.44" />
      <path d="M1 1l22 22" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}

function RecuperarSenhaForm({ onVoltar }: { onVoltar: () => void }) {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialResetState,
  );

  if (state.success) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[13px] text-brand-800">
          Se esse e-mail estiver cadastrado, enviamos um link para você
          redefinir sua senha. Confira também a caixa de spam.
        </p>
        <button
          type="button"
          onClick={onVoltar}
          className="text-[12.5px] font-semibold text-brand-700 hover:underline"
        >
          ← Voltar para o login
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-[13px] text-text-secondary">
        Informe o e-mail cadastrado — vamos te enviar um link para criar
        uma nova senha.
      </p>

      <div>
        <label htmlFor="resetEmail" className={labelClass}>
          E-mail
        </label>
        <input
          id="resetEmail"
          name="resetEmail"
          type="email"
          autoComplete="email"
          required
          placeholder="nome@viniplast.com.br"
          className={inputClass}
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-0.5">
        <button
          type="button"
          onClick={onVoltar}
          className="text-[12.5px] font-semibold text-text-secondary hover:underline"
        >
          ← Voltar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Enviando..." : "Enviar link"}
        </button>
      </div>
    </form>
  );
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialLoginState);
  const [mode, setMode] = useState<"login" | "recuperar">("login");
  const [showPassword, setShowPassword] = useState(false);

  if (mode === "recuperar") {
    return <RecuperarSenhaForm onVoltar={() => setMode("login")} />;
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className={labelClass}
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nome@viniplast.com.br"
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className={labelClass}
        >
          Senha
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••••"
            className={`${inputClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition hover:text-text-secondary"
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-0.5">
        <button
          type="button"
          onClick={() => setMode("recuperar")}
          className="text-[12.5px] font-medium text-brand-700 hover:underline"
        >
          Esqueci minha senha
        </button>
      </div>

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
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
