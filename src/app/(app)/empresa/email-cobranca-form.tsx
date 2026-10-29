"use client";

import { useState, useTransition } from "react";
import { atualizarEmailCobrancaEmpresa } from "./actions";

/**
 * E-mail de cobrança ADICIONAL da empresa — pedido do Rafael, 29/10/2026:
 * quando a empresa quer que a cobrança do Asaas também chegue num e-mail
 * diferente do e-mail de login do admin (ex. um financeiro@), sem trocar
 * o e-mail de login pra isso. Mesmo padrão de UI/estado de
 * LogoEmpresaForm (preview local + "Salvar" só habilitado quando algo
 * mudou), mas aqui é texto, não imagem — sem redimensionamento nem
 * FileReader.
 *
 * Aceita mais de um endereço separados por vírgula (mesmo formato exigido
 * pelo campo `additionalEmails` do Asaas) — a validação de formato e o
 * envio pro Asaas acontecem todos no server action
 * (atualizarEmailCobrancaEmpresa), este componente só mostra o resultado.
 */
export function EmailCobrancaForm({
  emailCobrancaAtual,
}: {
  emailCobrancaAtual: string | null;
}) {
  const [valor, setValor] = useState(emailCobrancaAtual ?? "");
  // Mesmo raciocínio de `salvo` em LogoEmpresaForm: começa igual ao que
  // veio do servidor, só atualiza depois de um "Salvar" bem-sucedido, pra
  // "Salvar" desabilitar de novo sem precisar recarregar a página.
  const [salvo, setSalvo] = useState(emailCobrancaAtual ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  function handleSalvar() {
    setError(null);
    setAviso(null);
    setSucesso(false);
    startTransition(async () => {
      const result = await atualizarEmailCobrancaEmpresa(valor);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSalvo(valor);
      setSucesso(true);
      if (result.aviso) setAviso(result.aviso);
    });
  }

  const alterado = valor.trim() !== salvo.trim();

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="email-cobranca"
          className="mb-2 block text-[12.5px] font-semibold text-text-secondary"
        >
          E-mail de cobrança adicional
        </label>
        <input
          id="email-cobranca"
          type="text"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setError(null);
            setSucesso(false);
            setAviso(null);
          }}
          placeholder="financeiro@suaempresa.com.br"
          className="w-full rounded-lg border border-border-strong px-3.5 py-2.5 text-[13.5px] text-foreground outline-none focus:border-brand-700"
        />
        <p className="mt-2 text-[11.5px] text-text-muted">
          Opcional. As cobranças do Asaas continuam chegando no e-mail de
          login do admin — este campo só ADICIONA outro(s) e-mail(s) que
          também vão recebê-las. Mais de um? Separe por vírgula. Deixe em
          branco e salve para remover.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">
          {error}
        </p>
      )}
      {sucesso && !aviso && (
        <p className="rounded-lg bg-brand-100 px-3.5 py-2.5 text-sm text-brand-700">
          E-mail de cobrança salvo.
        </p>
      )}
      {aviso && (
        <p className="rounded-lg bg-warning-bg px-3.5 py-2.5 text-sm text-warning-text">
          {aviso}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSalvar}
          disabled={pending || !alterado}
          className="rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
