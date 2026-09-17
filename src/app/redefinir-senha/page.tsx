"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ShieldIcon } from "@/components/brand/shield-icon";

type Status = "verificando" | "pronto" | "invalido" | "salvando" | "sucesso";

const inputClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3.5 py-3 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const labelClass =
  "mb-1.5 block text-[12.5px] font-semibold text-text-secondary";

// Página pública (ver PUBLIC_PATHS em middleware.ts) — chegamos aqui pelo
// link de recuperação de senha enviado por e-mail. O Supabase entrega a
// sessão de recuperação via fragmento da URL (#access_token=...), que só o
// navegador enxerga; por isso a verificação da sessão acontece aqui no
// cliente, não no servidor.
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("verificando");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? "pronto" : "invalido");
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (senha.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setError("As senhas não coincidem.");
      return;
    }

    setStatus("salvando");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: senha,
    });

    if (updateError) {
      setError("Não foi possível atualizar a senha. Peça um novo link.");
      setStatus("pronto");
      return;
    }

    await supabase.auth.signOut();
    setStatus("sucesso");
    setTimeout(() => router.push("/login"), 2500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border-subtle bg-surface p-8 shadow-[0_1px_2px_rgba(18,53,36,0.06),0_4px_16px_rgba(18,53,36,0.06)]">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <ShieldIcon className="h-12 w-12" />
          <h2 className="text-[19px] font-bold tracking-tight text-foreground">
            Redefinir senha
          </h2>
        </div>

        {status === "verificando" && (
          <p className="text-center text-[13px] text-text-secondary">
            Verificando o link...
          </p>
        )}

        {status === "invalido" && (
          <p className="rounded-lg bg-danger-bg px-3.5 py-3 text-[13px] text-danger-text">
            Esse link é inválido ou já expirou. Peça um novo link de
            recuperação na tela de login.
          </p>
        )}

        {status === "sucesso" && (
          <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[13px] text-brand-800">
            Senha atualizada com sucesso! Redirecionando para o login...
          </p>
        )}

        {(status === "pronto" || status === "salvando") && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="senha" className={labelClass}>
                Nova senha
              </label>
              <input
                id="senha"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••••"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="confirmar" className={labelClass}>
                Confirmar nova senha
              </label>
              <input
                id="confirmar"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="••••••••••"
                className={inputClass}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "salvando"}
              className="w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "salvando" ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
