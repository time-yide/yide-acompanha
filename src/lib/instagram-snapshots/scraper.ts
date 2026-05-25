// src/lib/instagram-snapshots/scraper.ts
import "server-only";
import { getServerEnv } from "@/lib/env";
import type { PostRecente, PostType, ScrapeStatus } from "./tipos";

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-profile-scraper";
const FETCH_TIMEOUT_MS = 60_000;

export interface ProfileSnapshotResult {
  status: ScrapeStatus;
  /** Total de posts do perfil. Null em erro. */
  totalPosts: number | null;
  /** Posts recentes processados (máx 50). Vazio em erro. */
  recentPosts: PostRecente[];
  /** Mensagem de erro se status != 'ok'. */
  erro?: string;
}

interface ApifyLatestPost {
  url?: string;
  shortCode?: string;
  timestamp?: string;
  type?: string;          // "Image" | "Video" | "Sidecar"
  productType?: string;   // "clips" pra reel
}

interface ApifyProfile {
  postsCount?: number;
  latestPosts?: ApifyLatestPost[];
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

function mapPostType(post: ApifyLatestPost): PostType {
  if (post.productType === "clips") return "reel";
  if (post.type === "Video" && (!post.productType || post.productType === "clips")) {
    return "reel";
  }
  // Image, Sidecar (carrossel) e Video sem clips → feed
  return "feed";
}

function buildPostUrl(post: ApifyLatestPost): string | null {
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
        usernames: [username],
        resultsLimit: 1,
        // resultsType controla o que vem. "details" inclui latestPosts.
        resultsType: "details",
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

    const items = (await resp.json()) as ApifyProfile[];
    if (!Array.isArray(items) || items.length === 0) {
      return {
        status: "profile_not_found",
        totalPosts: null,
        recentPosts: [],
        erro: "Perfil não encontrado ou privado",
      };
    }

    const profile = items[0];
    const totalPosts = typeof profile.postsCount === "number" ? profile.postsCount : null;

    const recentPosts: PostRecente[] = (profile.latestPosts ?? [])
      .filter((p) => p.timestamp)
      .slice(0, 50)
      .map((p) => {
        const url = buildPostUrl(p);
        return url
          ? { url, timestamp: p.timestamp!, type: mapPostType(p) }
          : null;
      })
      .filter((p): p is PostRecente => p !== null);

    return { status: "ok", totalPosts, recentPosts };
  } catch (err) {
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
