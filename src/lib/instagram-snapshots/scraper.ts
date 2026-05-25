// src/lib/instagram-snapshots/scraper.ts
import "server-only";
import { getServerEnv } from "@/lib/env";
import type { PostRecente, PostType, ScrapeStatus } from "./tipos";

const APIFY_BASE = "https://api.apify.com/v2";
// instagram-scraper (não o profile-scraper) — esse aceita resultsLimit
// controlando quantos POSTS retornar, não só perfis. Trocamos pra ele porque
// o profile-scraper retorna fixo ~30 posts em latestPosts, ficando curto
// pra contas que postam 1+ por dia (mês fica subestimado).
const ACTOR_ID = "apify~instagram-scraper";
// Quanto puxar por scrape. 100 cobre folgado mês inteiro de qualquer conta
// (raramente passa de 60 posts/mês). Mais que isso vira gasto Apify sem retorno.
const POSTS_LIMIT = 100;
// Apify às vezes demora 60-90s (retries internos do actor). 120s dá margem
// sem virar problema no serverless (Vercel free aceita 300s em route handlers).
const FETCH_TIMEOUT_MS = 120_000;
// Apify às vezes retorna no_items, dataset vazio ou timeout transitório no
// 1º try. Re-tentando 1× depois de 3s resolve uns 70% dos casos sem deixar
// a UI travada por muito tempo.
const RETRY_DELAY_MS = 3_000;

export interface ProfileSnapshotResult {
  status: ScrapeStatus;
  /** Total de posts do perfil. Pode ser null — instagram-scraper não retorna postsCount. */
  totalPosts: number | null;
  /** Posts recentes processados (até POSTS_LIMIT). Vazio em erro. */
  recentPosts: PostRecente[];
  /** Mensagem de erro se status != 'ok'. */
  erro?: string;
}

/**
 * Shape de cada item retornado pelo apify/instagram-scraper em modo "posts".
 * Diferente do profile-scraper, aqui o array do dataset é diretamente posts.
 */
interface ApifyPostItem {
  url?: string;
  shortCode?: string;
  timestamp?: string;
  type?: string;          // "Image" | "Video" | "Sidecar"
  productType?: string;   // "clips" pra reel
  /** Quando o scrape falha em achar o perfil, vem `error: 'no_items'` ou similar. */
  error?: string;
}

/**
 * Normaliza username/URL. Aceita "@user", "user", "https://instagram.com/user/".
 * Retorna null se não conseguir extrair username.
 */
export function normalizeUsername(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let user = raw.trim();
  if (!user) return null;
  if (user.startsWith("@")) user = user.slice(1);
  const m = user.match(/instagram\.com\/([^/?#]+)/i);
  if (m) user = m[1];
  user = user.replace(/\/$/, "");
  return user.length > 0 ? user : null;
}

function mapPostType(post: ApifyPostItem): PostType {
  if (post.productType === "clips") return "reel";
  if (post.type === "Video" && (!post.productType || post.productType === "clips")) {
    return "reel";
  }
  // Image, Sidecar (carrossel) e Video sem clips → feed
  return "feed";
}

function buildPostUrl(post: ApifyPostItem): string | null {
  if (post.url) return post.url;
  if (post.shortCode) return `https://www.instagram.com/p/${post.shortCode}/`;
  return null;
}

/**
 * Heurística pra decidir se vale re-tentar. Erros do Apify tipo `no_items`,
 * timeouts e rate-limit costumam ser flaky — perfil existe mas o scrape
 * falhou nesse run específico. Já 'profile_not_found' por username inválido
 * é determinístico e re-tentar não muda nada.
 */
function isErroTransitorio(result: ProfileSnapshotResult): boolean {
  if (result.status === "ok") return false;
  const msg = (result.erro ?? "").toLowerCase();
  if (/no_items/.test(msg)) return true;
  if (/timeout|aborted|demorou/.test(msg)) return true;
  if (/rate.?limit/i.test(msg)) return true;
  if (/temporar/i.test(msg)) return true;
  // HTTP 5xx do Apify (servidor deles) também é transitório.
  if (/HTTP 5\d\d/.test(result.erro ?? "")) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Uma única tentativa de scrape. Toda lógica de fetch+parse mora aqui;
 * a função pública embrulha em retry quando o erro for transitório.
 */
async function scrapeOnce(username: string, token: string): Promise<ProfileSnapshotResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: "posts",
        resultsLimit: POSTS_LIMIT,
        // Sem dados do perfil — só posts. Mais barato e suficiente.
        addParentData: false,
      }),
      signal: controller.signal,
    });

    if (resp.status === 429) {
      return { status: "rate_limit", totalPosts: null, recentPosts: [], erro: "Rate limit Apify" };
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return {
        status: "error",
        totalPosts: null,
        recentPosts: [],
        erro: `HTTP ${resp.status}: ${text.slice(0, 200)}`,
      };
    }

    const items = (await resp.json()) as ApifyPostItem[];
    if (!Array.isArray(items) || items.length === 0) {
      return {
        status: "profile_not_found",
        totalPosts: null,
        recentPosts: [],
        // Mantém 'no_items' literal — isErroTransitorio detecta esse marker pra retry.
        erro: "no_items",
      };
    }

    // Quando o perfil não existe, o scraper retorna 1 item com `error`.
    if (items.length === 1 && items[0].error) {
      return {
        status: "profile_not_found",
        totalPosts: null,
        recentPosts: [],
        erro: items[0].error,
      };
    }

    const recentPosts: PostRecente[] = items
      .filter((p) => p.timestamp && !p.error)
      .map((p) => {
        const url = buildPostUrl(p);
        return url
          ? { url, timestamp: p.timestamp!, type: mapPostType(p) }
          : null;
      })
      .filter((p): p is PostRecente => p !== null);

    return {
      status: "ok",
      // instagram-scraper não retorna postsCount do perfil. Deixa null —
      // não é usado pra contagem (que é derivada dos timestamps).
      totalPosts: null,
      recentPosts,
    };
  } catch (err) {
    // AbortError = nosso timeout local. Mensagem amigável + sugestão de retry.
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || /aborted/i.test(err.message));
    if (isAbort) {
      return {
        status: "error",
        totalPosts: null,
        recentPosts: [],
        erro: `Apify demorou mais de ${FETCH_TIMEOUT_MS / 1000}s pra responder. Tente atualizar de novo em 1-2 min.`,
      };
    }
    return {
      status: "error",
      totalPosts: null,
      recentPosts: [],
      erro: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Faz scraping de UM perfil. Não persiste — só retorna o resultado.
 * Persistência é responsabilidade do caller (actions / cron).
 *
 * Re-tenta 1× automaticamente quando o 1º try cai em erro transitório
 * (no_items, timeout, 5xx, rate_limit). Casos como `profile_not_found`
 * por username errado NÃO re-tentam — seria gastar quota à toa.
 */
export async function fetchProfileSnapshot(
  instagramUrlOrUser: string | null | undefined,
): Promise<ProfileSnapshotResult> {
  const username = normalizeUsername(instagramUrlOrUser);
  if (!username) {
    return { status: "no_url", totalPosts: null, recentPosts: [] };
  }

  const env = getServerEnv();
  const token = env.APIFY_API_TOKEN;
  if (!token) {
    return {
      status: "error",
      totalPosts: null,
      recentPosts: [],
      erro: "APIFY_API_TOKEN não configurado",
    };
  }

  const first = await scrapeOnce(username, token);
  if (!isErroTransitorio(first)) return first;

  // Segunda chance — espera 3s pra dar tempo do estado do Apify estabilizar.
  await sleep(RETRY_DELAY_MS);
  const second = await scrapeOnce(username, token);
  // Se o retry também falhou transitório, devolve o erro do 2º try
  // (geralmente é a mesma mensagem, mas o user vê que a gente já tentou).
  return second;
}
