/**
 * Fallback de carregamento compartilhado por toda rota protegida
 * (dashboard, empresas, colaboradores, estoque, usuários, pagamentos, EPIs,
 * movimentações, estações, empresa, auditoria, relatórios etc.) — o Next
 * mostra isto automaticamente, via Suspense, enquanto o conteúdo da página
 * (depois do layout) ainda está buscando dados no servidor.
 *
 * Antes deste arquivo não existia NENHUM loading.tsx em todo o app: a tela
 * ficava parada/em branco do clique até a página inteira terminar de
 * renderizar no servidor, sem nenhum feedback instantâneo — uma das causas
 * da navegação "meio lenta" percebida ao trocar de tela. Isso não faz as
 * consultas em si ficarem mais rápidas (ver cache() em getCurrentUser e a
 * contarEmpresasNoLimite() mais enxuta, as outras duas partes desta mesma
 * correção) — só garante que algo aparece na hora, em vez de tela
 * congelada.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-500" />
      <p className="text-[13px] font-medium text-text-muted">Carregando…</p>
    </div>
  );
}
