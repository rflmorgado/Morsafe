"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { criarUsuario } from "./actions";

/**
 * Cadastra um novo login pra um colega da própria empresa. A senha é
 * definida aqui mesmo pelo admin (não existe convite por e-mail ainda) —
 * o admin repassa a senha diretamente pra pessoa depois de criar.
 */
export function NovoUsuarioButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await criarUsuario({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
      >
        + Novo usuário
      </button>

      <Modal open={open} onClose={handleClose} title="Novo usuário">
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="novo-usuario-nome"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Nome
            </label>
            <input
              id="novo-usuario-nome"
              name="nome"
              type="text"
              required
              placeholder="Nome completo"
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label
              htmlFor="novo-usuario-email"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              E-mail de login
            </label>
            <input
              id="novo-usuario-email"
              name="email"
              type="email"
              required
              placeholder="nome@empresa.com"
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label
              htmlFor="novo-usuario-senha"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Senha inicial
            </label>
            <input
              id="novo-usuario-senha"
              name="senha"
              type="text"
              required
              minLength={6}
              placeholder="Ao menos 6 caracteres"
              autoComplete="new-password"
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <p className="mt-1 text-[11.5px] text-text-muted">
              Repasse essa senha diretamente pra pessoa — ela pode trocar
              depois de entrar.
            </p>
          </div>

          <div>
            <label
              htmlFor="novo-usuario-papel"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Papel
            </label>
            <select
              id="novo-usuario-papel"
              name="papel"
              required
              defaultValue="encarregado"
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="leitura">Leitura — só visualiza</option>
              <option value="encarregado">
                Encarregado — cadastra, edita e importa
              </option>
              <option value="admin">
                Admin — tudo, inclusive desligar/excluir e gerenciar usuários
              </option>
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-text-secondary transition hover:bg-surface-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Criando..." : "Criar usuário"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
