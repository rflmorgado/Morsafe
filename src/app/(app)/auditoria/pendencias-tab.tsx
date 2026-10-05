import Link from "next/link";
import {
  apurarAuditoriaRegistros,
  type GrupoPendencia,
} from "@/lib/data/auditoria-registros";
import { Card } from "@/components/ui/card";

const SEVERIDADE_STYLE = {
  critico: {
    badge: "bg-danger-bg text-danger-text",
    label: "Crítica",
  },
  atencao: {
    badge: "bg-warning-bg text-warning-text",
    label: "Atenção",
  },
} as const;

function GrupoPendenciaCard({ grupo }: { grupo: GrupoPendencia }) {
  const estilo = SEVERIDADE_STYLE[grupo.severidade];
  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${estilo.badge}`}
        >
          {estilo.label}
        </span>
        <p className="text-[13.5px] font-bold text-foreground">
          {grupo.titulo}
        </p>
        <span className="text-[12px] text-text-muted">
          ({grupo.itens.length})
        </span>
      </div>
      <p className="mb-3 text-[12px] text-text-secondary">
        {grupo.descricao}
      </p>
      <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
        {grupo.itens.map((item, i) => (
          <li
            key={i}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          >
            <span className="text-[12.5px] text-foreground">
              {item.titulo}
            </span>
            <Link
              href={item.href}
              className="shrink-0 text-[12px] font-semibold text-brand-700 hover:underline"
            >
              {item.acaoLabel} →
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * "Pendências" — mesma apuração da Visão Geral (ver apurarAuditoriaRegistros
 * em lib/data/auditoria-registros.ts), só que detalhada item a item em vez
 * de resumida em números. Pedido do Rafael, 06/10/2026: "isso transforma a
 * auditoria em ferramenta de gestão, não apenas relatório".
 *
 * O rótulo de cada ação ("Corrigir cadastro" vs "Ver registro" vs
 * "Registrar entrega") é deliberado, não um botão genérico "Corrigir" pra
 * tudo: uma devolução antiga sem assinatura é um registro HISTÓRICO
 * (imutável por regra do projeto, ver CLAUDE.md regra 3) — não tem como
 * "corrigir" isso sem forjar uma assinatura que nunca existiu, então o link
 * só leva pra visualizar o registro. Já um EPI sem C.A. completo é cadastro
 * vivo, dá pra editar de verdade — "Corrigir cadastro" leva pra lá. E um
 * colaborador sem o EPI obrigatório não tem "registro errado" pra corrigir,
 * só falta uma entrega nova — "Registrar entrega" leva pro formulário certo.
 */
export async function PendenciasTab({
  empresaId,
}: {
  empresaId: string | null;
}) {
  const apuracao = await apurarAuditoriaRegistros(empresaId);

  if (apuracao.pendencias.length === 0) {
    return (
      <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-[13.5px] text-text-secondary shadow-card">
        Nenhuma pendência encontrada nos registros analisados.
      </p>
    );
  }

  const criticas = apuracao.pendencias.filter((p) => p.severidade === "critico");
  const atencao = apuracao.pendencias.filter((p) => p.severidade === "atencao");

  return (
    <div className="space-y-6">
      {criticas.length > 0 && (
        <div>
          <p className="mb-2.5 text-[12.5px] font-bold tracking-wide text-danger-text uppercase">
            Críticas — {criticas.reduce((n, g) => n + g.itens.length, 0)}
          </p>
          <div className="space-y-3">
            {criticas.map((g) => (
              <GrupoPendenciaCard key={g.tipo} grupo={g} />
            ))}
          </div>
        </div>
      )}

      {atencao.length > 0 && (
        <div>
          <p className="mb-2.5 text-[12.5px] font-bold tracking-wide text-warning-text uppercase">
            Atenção — {atencao.reduce((n, g) => n + g.itens.length, 0)}
          </p>
          <div className="space-y-3">
            {atencao.map((g) => (
              <GrupoPendenciaCard key={g.tipo} grupo={g} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
