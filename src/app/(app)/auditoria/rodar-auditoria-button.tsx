"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { rodarAuditoria } from "./actions";
import { PERGUNTAS_AUDITORIA_NR06 } from "@/lib/data/auditorias-nr06-perguntas";

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const OPCOES_RESPOSTA: {
  valor: "sim" | "nao" | "na";
  label: string;
  classeSelecionada: string;
}[] = [
  {
    valor: "sim",
    label: "Sim",
    classeSelecionada:
      "peer-checked:border-brand-600 peer-checked:bg-brand-100 peer-checked:text-brand-700",
  },
  {
    valor: "nao",
    label: "Não",
    classeSelecionada:
      "peer-checked:border-danger-text peer-checked:bg-danger-bg peer-checked:text-danger-text",
  },
  {
    valor: "na",
    label: "N/A",
    classeSelecionada:
      "peer-checked:border-border-strong peer-checked:bg-surface-muted peer-checked:text-text-secondary",
  },
];

const VALORES_RESPOSTA_VALIDOS = new Set(
  OPCOES_RESPOSTA.map((o) => o.valor as string),
);

export function RodarAuditoriaButton({
  setorId,
  setorNome,
  responsavelPadrao,
  variant = "link",
}: {
  setorId: string;
  setorNome: string;
  responsavelPadrao: string;
  // "link" é o padrão (usado na linha da tabela em /auditoria, ao lado de
  // "Ver histórico" — uma ação discreta entre várias linhas). "solid" é pro
  // topo da tela de histórico de um setor (/auditoria/[setorId]), onde é a
  // única ação da tela e merece destaque — mesmo raciocínio do `variant` em
  // RegistrarEntradaButton (ver estoque/registrar-entrada-button.tsx).
  variant?: "link" | "solid";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Chaves das perguntas (ver PERGUNTAS_AUDITORIA_NR06) ainda sem resposta
  // na última tentativa de salvar — usado só pra destacar visualmente qual
  // pergunta falta responder (ver renderização abaixo). Pedido do Rafael,
  // 06/10/2026: sem isso, uma pergunta esquecida virava silenciosamente a
  // mesma coisa que "N/A" no banco, sem nenhum aviso.
  const [perguntasFaltando, setPerguntasFaltando] = useState<Set<string>>(
    new Set(),
  );
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  function handleClose() {
    setOpen(false);
    setError(null);
    setPerguntasFaltando(new Set());
  }

  function handleSubmit(formData: FormData) {
    setError(null);

    // Validação no navegador — resposta imediata, sem round-trip ao
    // servidor. A mesma checagem é refeita em rodarAuditoria (actions.ts)
    // como segunda camada, nunca confiando só nisto aqui.
    const faltando = PERGUNTAS_AUDITORIA_NR06.filter(
      (p) => !VALORES_RESPOSTA_VALIDOS.has(String(formData.get(p.chave) ?? "")),
    );
    if (faltando.length > 0) {
      setPerguntasFaltando(new Set(faltando.map((p) => p.chave)));
      setError(
        faltando.length === 1
          ? `Responda a pergunta "${faltando[0].pergunta}" antes de salvar (marque Sim, Não ou N/A).`
          : `Responda todas as perguntas antes de salvar — faltam ${faltando.length}: ${faltando
              .map((p) => `"${p.pergunta}"`)
              .join(", ")}.`,
      );
      return;
    }
    setPerguntasFaltando(new Set());

    startTransition(async () => {
      const result = await rodarAuditoria({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setFormKey((k) => k + 1);
    });
  }

  return (
    <>
      <button
        type="button"
        // stopPropagation: na listagem (/auditoria), a linha/cartão inteiro
        // agora leva ao histórico do setor (ver auditoria/page.tsx, mesmo
        // padrão de pagamentos/marcar-pago-button.tsx) — sem isso, clicar
        // neste botão também navegaria pro histórico por cima da abertura do
        // modal. Inofensivo no uso "solid" (auditoria/[setorId]/page.tsx),
        // que não fica dentro de nenhuma linha clicável.
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          variant === "solid"
            ? "rounded-lg bg-brand-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-800"
            : "text-[12.5px] font-semibold text-brand-700 hover:underline"
        }
      >
        {variant === "solid" ? "+ Rodar nova auditoria" : "Rodar auditoria"}
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title={`Auditoria NR-06 — ${setorNome}`}
      >
        <form key={formKey} action={handleSubmit} className="space-y-4">
          <input type="hidden" name="setor_id" value={setorId} />

          <p className="rounded-lg bg-surface-muted px-3.5 py-2.5 text-[12.5px] text-text-secondary">
            Responda todas as perguntas antes de salvar — marque “N/A” o que
            não se aplica a este setor hoje (não dá pra deixar em branco).
            Uma resposta “Não” fica marcada como pendência no histórico, mas
            não impede o registro da auditoria.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="auditoria-responsavel"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Responsável
              </label>
              <input
                id="auditoria-responsavel"
                name="responsavel"
                type="text"
                required
                defaultValue={responsavelPadrao}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label
                htmlFor="auditoria-data"
                className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
              >
                Data
              </label>
              <input
                id="auditoria-data"
                name="data"
                type="date"
                defaultValue={hojeISO()}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="space-y-3">
            {PERGUNTAS_AUDITORIA_NR06.map((p) => {
              const faltando = perguntasFaltando.has(p.chave);
              return (
                <div
                  key={p.chave}
                  className={
                    faltando
                      ? "rounded-lg border border-danger-text/50 bg-danger-bg/40 p-2.5"
                      : undefined
                  }
                >
                  <p
                    className={`mb-1.5 text-[12.5px] font-medium ${
                      faltando ? "text-danger-text" : "text-foreground"
                    }`}
                  >
                    {p.pergunta}
                    {faltando && (
                      <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide">
                        — não respondida
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    {OPCOES_RESPOSTA.map((opcao) => (
                      <label key={opcao.valor} className="flex-1">
                        <input
                          type="radio"
                          name={p.chave}
                          value={opcao.valor}
                          className="peer sr-only"
                          // Some o destaque assim que a pessoa escolhe uma
                          // opção pra essa pergunta específica — sem esperar
                          // um novo clique em "Registrar auditoria".
                          onChange={() => {
                            setPerguntasFaltando((prev) => {
                              if (!prev.has(p.chave)) return prev;
                              const next = new Set(prev);
                              next.delete(p.chave);
                              return next;
                            });
                          }}
                        />
                        <span
                          className={`block cursor-pointer rounded-lg border border-border-strong py-1.5 text-center text-[12px] font-semibold text-text-secondary transition hover:bg-surface-muted ${opcao.classeSelecionada}`}
                        >
                          {opcao.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <label
              htmlFor="auditoria-observacoes"
              className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary"
            >
              Observações{" "}
              <span className="font-normal text-text-muted">(opcional)</span>
            </label>
            <textarea
              id="auditoria-observacoes"
              name="observacoes"
              rows={3}
              placeholder="Detalhes sobre pendências encontradas, ações já tomadas, etc."
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition placeholder:text-text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
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
              {pending ? "Salvando..." : "Registrar auditoria"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
