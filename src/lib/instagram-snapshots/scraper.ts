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
 * Faz scraping de UM perfil. Não persiste — só retorna o resultado.
 * Persistência é responsabilidade do caller (actions / cron).
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
      // Detecta limite mensal do plano Apify estourado (HTTP 403 com type
      // "platform-feature-disabled"). UX melhor que "HTTP 403".
      if (resp.status === 403 && /Monthly usage hard limit exceeded|platform-feature-disabled/i.test(text)) {
        return {
          status: "error",
          totalPosts: null,
          recentPosts: [],
          erro: "Limite mensal do plano Apify atingido. Adicione créditos em console.apify.com/billing ou aguarde reset do ciclo.",
        };
      }
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
        erro: "Perfil não encontrado ou privado",
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
