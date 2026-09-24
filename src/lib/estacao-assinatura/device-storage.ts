// Lido/escrito só no navegador do aparelho pareado (tablet/celular da
// empresa) — nunca no servidor. Guarda o token permanente da estação (ver
// src/app/estacao/actions.ts) pra não precisar parear de novo toda vez que
// a página é reaberta; é por isso que o "modo estação" funciona como um
// app instalado (adicionar à tela inicial mantém esse localStorage).
const CHAVE_TOKEN = "morsafe:estacao:token";
const CHAVE_NOME = "morsafe:estacao:nome";

export function salvarCredencialEstacao(token: string, nome: string) {
  try {
    window.localStorage.setItem(CHAVE_TOKEN, token);
    window.localStorage.setItem(CHAVE_NOME, nome);
  } catch {
    // Navegador privado/bloqueado — sem isso a estação não guarda
    // credencial nenhuma; a tela seguinte trata token vazio normalmente.
  } finally {
    notificarMudancaCredencial();
  }
}

export function lerCredencialEstacao(): {
  token: string | null;
  nome: string | null;
} {
  try {
    return {
      token: window.localStorage.getItem(CHAVE_TOKEN),
      nome: window.localStorage.getItem(CHAVE_NOME),
    };
  } catch {
    return { token: null, nome: null };
  }
}

export function limparCredencialEstacao() {
  try {
    window.localStorage.removeItem(CHAVE_TOKEN);
    window.localStorage.removeItem(CHAVE_NOME);
  } catch {
    // Nada a fazer — melhor esforço, igual acima.
  } finally {
    notificarMudancaCredencial();
  }
}

// --- Suporte a useSyncExternalStore (ver src/app/estacao/page.tsx) ---------
//
// A tela do aparelho pareado precisa ler essa credencial já no primeiro
// render do cliente sem gerar um mismatch de hidratação (o servidor nunca
// tem localStorage) e precisa se atualizar sozinha quando a própria tela
// troca a credencial (pareamento novo, "desparear"). useSyncExternalStore
// resolve os dois problemas sem precisar de useEffect+setState pra só
// espelhar esse valor externo.

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();

function notificarMudancaCredencial() {
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarCredencialEstacao(callback: Ouvinte) {
  ouvintes.add(callback);
  return () => {
    ouvintes.delete(callback);
  };
}

// Só existe pra diferenciar "ainda não sei" (servidor / primeiro paint do
// cliente) de "sei que não tem token" (null de verdade, depois de ler o
// localStorage) — nunca é um token real.
export const TOKEN_ESTACAO_PLACEHOLDER_SSR = "__carregando__";

export function getTokenEstacaoSnapshot(): string | null {
  return lerCredencialEstacao().token;
}

export function getTokenEstacaoSnapshotServidor(): string {
  return TOKEN_ESTACAO_PLACEHOLDER_SSR;
}

export function getNomeEstacaoSnapshot(): string | null {
  return lerCredencialEstacao().nome;
}

export function getNomeEstacaoSnapshotServidor(): string | null {
  return null;
}
