// Recuperação automática da "tela preta / erro de aplicação" após deploy.
//
// Quando a Vercel publica uma versão nova, os arquivos de JS/CSS ganham hashes
// novos no nome e os antigos deixam de existir. Uma aba que ficou aberta na
// versão velha, ao navegar ou carregar um pedaço da página sob demanda, tenta
// buscar um arquivo que sumiu (404) → dispara um "ChunkLoadError" → a tela
// quebra. A cura é recarregar pra buscar o HTML/JS da versão nova.
//
// Por que o reload simples às vezes NÃO resolvia (deixava o usuário travado):
//   1. `location.reload()` podia re-servir o MESMO HTML velho do cache do
//      navegador (bfcache/HTTP cache), que aponta pros chunks que sumiram →
//      erro de novo.
//   2. A trava antiga deixava recarregar só 1x; se a 1ª não resolvia, desistia
//      e mostrava o erro.
// Agora: o reload fura o cache (param `_fresh`) e escalamos até 2 tentativas —
// a 2ª limpa Cache Storage + service workers antes de recarregar.

const CHUNK_ERROR_PATTERNS = [
  /loading chunk [\w-]+ failed/i,
  /loading css chunk [\w-]+ failed/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
];

/** Identifica se um erro é de carregamento de chunk (versão antiga da página). */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: string; message?: string };
  if (err.name === "ChunkLoadError") return true;
  const message = typeof err.message === "string" ? err.message : String(error);
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(message));
}

// --- Trava anti-loop com escalonamento -------------------------------------

const RELOAD_COUNT_KEY = "chunk-reload-count";
const RELOAD_TIME_KEY = "chunk-reload-at";
/** Janela em que as tentativas contam como "do mesmo deploy quebrado". */
export const RELOAD_WINDOW_MS = 60_000;
/** Máximo de reloads antes de desistir e deixar o erro seguir o fluxo normal. */
export const MAX_RELOADS = 2;
/** Query param de cache-busting; removido da URL assim que a página carrega ok. */
export const FRESH_PARAM = "_fresh";

/** Subconjunto de Storage que o planner usa — facilita testar sem o DOM. */
type GuardStore = Pick<Storage, "getItem" | "setItem">;

export interface RecoveryPlan {
  /** Índice 0-based da tentativa que vamos executar agora. */
  attempt: number;
  /** Se deve limpar caches/service workers antes de recarregar (escalonamento). */
  hardClear: boolean;
}

/**
 * Decide o próximo passo de recuperação a partir do estado da trava. Puro
 * (sem tocar em window) pra ser testável. Retorna `null` quando já esgotamos
 * as tentativas na janela — aí o erro segue pro fallback/Sentry, sem loop.
 */
export function planRecovery(now: number, store: GuardStore): RecoveryPlan | null {
  const last = Number(store.getItem(RELOAD_TIME_KEY) || 0);
  const dentroDaJanela = now - last < RELOAD_WINDOW_MS;
  const feitas = dentroDaJanela ? Number(store.getItem(RELOAD_COUNT_KEY) || 0) : 0;
  if (feitas >= MAX_RELOADS) return null;
  store.setItem(RELOAD_COUNT_KEY, String(feitas + 1));
  store.setItem(RELOAD_TIME_KEY, String(now));
  return { attempt: feitas, hardClear: feitas >= 1 };
}

/** Zera a trava: chamado quando a página carrega de fato (recuperação ok). */
export function markRecovered(store: Pick<Storage, "removeItem">): void {
  try {
    store.removeItem(RELOAD_COUNT_KEY);
    store.removeItem(RELOAD_TIME_KEY);
  } catch {
    // storage indisponível — ignora.
  }
}

// --- Efeitos no browser -----------------------------------------------------

async function hardClear(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignora — clear é best-effort.
  }
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // ignora — o PWARegister re-registra o SW no próximo load.
  }
}

function reloadBustingCache(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(FRESH_PARAM, String(Date.now()));
    // replace (não push) pra não empilhar histórico a cada tentativa.
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

/**
 * Recarrega a página pra buscar a versão mais recente, furando o cache. Retorna
 * `true` se vai recarregar (caller pode pular o fallback), `false` se a trava
 * já esgotou as tentativas (= não é só versão velha; deixa o erro aparecer).
 */
export function reloadForFreshVersion(): boolean {
  if (typeof window === "undefined") return false;

  let plan: RecoveryPlan | null;
  try {
    plan = planRecovery(Date.now(), window.sessionStorage);
  } catch {
    // sessionStorage indisponível (modo privado antigo): tenta um reload único.
    plan = { attempt: 0, hardClear: false };
  }
  if (!plan) return false;

  void (async () => {
    if (plan.hardClear) await hardClear();
    reloadBustingCache();
  })();
  return true;
}

/**
 * Limpa o `_fresh` da URL e zera a trava. Chamar quando a app montou de fato
 * (= recuperação bem-sucedida), pra deixar a URL limpa e dar tentativas novas
 * num futuro deploy.
 */
export function onAppMounted(): void {
  if (typeof window === "undefined") return;
  try {
    markRecovered(window.sessionStorage);
  } catch {
    // ignora.
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(FRESH_PARAM)) {
      url.searchParams.delete(FRESH_PARAM);
      const qs = url.searchParams.toString();
      window.history.replaceState(null, "", url.pathname + (qs ? `?${qs}` : "") + url.hash);
    }
  } catch {
    // ignora.
  }
}
