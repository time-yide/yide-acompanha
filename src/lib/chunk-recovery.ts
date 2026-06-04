// Recuperação automática da "tela preta" após deploy.
//
// Quando a Vercel publica uma versão nova, os arquivos de JS/CSS ganham hashes
// novos no nome e os antigos deixam de existir. Uma aba que ficou aberta na
// versão velha, ao navegar ou carregar um pedaço da página sob demanda, tenta
// buscar um arquivo que sumiu (404) → dispara um "ChunkLoadError" → a tela
// quebra/escurece. A cura é simples: recarregar a página pra buscar o HTML/JS
// da versão nova.

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

// Trava anti-loop: recarrega no máximo uma vez por janela curta de tempo. Se o
// reload não resolver (ex: erro real, não de deploy), não fica recarregando em
// loop — depois do cooldown o erro segue o fluxo normal (Sentry/fallback).
const RELOAD_GUARD_KEY = "chunk-reload-at";
const RELOAD_COOLDOWN_MS = 15_000;

/**
 * Recarrega a página uma vez para buscar a versão mais recente. Retorna `true`
 * se de fato disparou o reload, `false` se a trava impediu (reload recente).
 */
export function reloadForFreshVersion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage indisponível (modo privado de browsers antigos): segue
    // com o reload mesmo sem trava — o risco de loop é baixo na prática.
  }
  window.location.reload();
  return true;
}
