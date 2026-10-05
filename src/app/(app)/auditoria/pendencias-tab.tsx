import Link from "next/link";
import {
  apurarAuditoriaRegistros,
  type GrupoPendencia,
} from "@/lib/data/auditoria-registros";
import { Card } from "@/components/ui/card";

// Mesmo tamanho de página usado nas abas Colaboradores/EPIs desta mesma tela
// (ver COLABORADORES_TAB_PAGE_SIZE em colaboradores-tab.tsx e
// EPIS_TAB_PAGE_SIZE em epis-tab.tsx) — pedido do Rafael, 05/10/2026: alguns
// grupos de pendência (ex.: "Colaboradores com EPI obrigatório pendente")
// podem ter uma lista tão grande quanto a de colaboradores da empresa. Cada
// grupo tem a SUA PRÓPRIA paginação, independente dos outros — por isso a
// chave na URL é por tipo de grupo (`p_<tipo>`), em vez de uma única
// `pagina` compartilhada como nas outras duas abas (lá só existe UMA lista
// por vez).
const PENDENCIAS_TAB_PAGE_SIZE = 20;

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

function paramDaPagina(tipo: string) {
  return `p_${tipo}`;
}

// Monta o link de paginação de UM grupo preservando a página de todos os
// OUTROS grupos na mesma tela — cada link troca só a própria chave
// `p_<tipo>` na URL, sem resetar a paginação dos demais cartões.
function hrefPagina(
  searchParams: Record<string, string | undefined>,
  tipo: string,
  novaPagina: number,
) {
  const params = new URLSearchParams();
  params.set("aba", "pendencias");
  for (const [chave, valor] of Object.entries(searchParams)) {
    if (chave === "aba" || chave === paramDaPagina(tipo) || !valor) continue;
    params.set(chave, valor);
  }
  params.set(paramDaPagina(tipo), String(novaPagina));
  return `/auditoria?${params.toString()}`;
}

function GrupoPendenciaCard({
  grupo,
  searchParams,
}: {
  grupo: GrupoPendencia;
  searchParams: Record<string, string | undefined>;
}) {
  const estilo = SEVERIDADE_STYLE[grupo.severidade];
  const total = grupo.itens.length;
  const totalPaginas = Math.max(1, Math.ceil(total / PENDENCIAS_TAB_PAGE_SIZE));
  const paginaBruta = Number(searchParams[paramDaPagina(grupo.tipo)]);
  const paginaAtual =
    Number.isFinite(paginaBruta) && paginaBruta > 0
      ? Math.min(Math.floor(paginaBruta), totalPaginas)
      : 1;
  const inicio = (paginaAtual - 1) * PENDENCIAS_TAB_PAGE_SIZE;
  const itensPagina = grupo.itens.slice(
    inicio,
    inicio + PENDENCIAS_TAB_PAGE_SIZE,
  );

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
        <span className="text-[12px] text-text-muted">({total})</span>
      </div>
      <p className="mb-3 text-[12px] text-text-secondary">
        {grupo.descricao}
      </p>
      <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
        {itensPagina.map((item, i) => (
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

      <div className="mt-3 flex flex-col items-center justify-between gap-2 sm:flex-row">
        <span className="text-[11.5px] text-text-muted">
          Página {paginaAtual} de {totalPaginas} · {total}{" "}
          {total === 1 ? "item" : "itens"}
        </span>
        <div className="flex gap-2">
          <Link
            href={hrefPagina(searchParams, grupo.tipo, paginaAtual - 1)}
            aria-disabled={paginaAtual <= 1}
            tabIndex={paginaAtual <= 1 ? -1 : undefined}
            className={`rounded-lg border border-border-strong px-3 py-1.5 text-[11.5px] font-semibold text-foreground transition ${
              paginaAtual <= 1
                ? "pointer-events-none opacity-40"
                : "hover:bg-surface-muted"
            }`}
          >
            ← Anterior
          </Link>
          <Link
            href={hrefPagina(searchParams, grupo.tipo, paginaAtual + 1)}
            aria-disabled={paginaAtual >= totalPaginas}
            tabIndex={paginaAtual >= totalPaginas ? -1 : undefined}
            className={`rounded-lg border border-border-strong px-3 py-1.5 text-[11.5px] font-semibold text-foreground transition ${
              paginaAtual >= totalPaginas
                ? "pointer-events-none opacity-40"
                : "hover:bg-surface-muted"
            }`}
          >
            Próxima →
          </Link>
        </div>
      </div>
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
 *
 * Paginação (20 por grupo): mesmo padrão das abas Colaboradores/EPIs desta
 * tela — pedido do Rafael, 05/10/2026. `searchParams` vem direto de
 * page.tsx (todos os parâmetros da URL) pra cada cartão poder montar o
 * próprio link de página sem apagar a paginação dos outros cartões.
 */
export async function PendenciasTab({
  empresaId,
  searchParams,
}: {
  empresaId: string | null;
  searchParams: Record<string, string | undefined>;
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
              <GrupoPendenciaCard
                key={g.tipo}
                grupo={g}
                searchParams={searchParams}
              />
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
              <GrupoPendenciaCard
                key={g.tipo}
                grupo={g}
                searchParams={searchParams}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
