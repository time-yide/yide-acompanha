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
// Fallback: alguns perfis (ex.: nazcasushi) o instagram-scraper retorna
// no_items consistentemente, mesmo com perfil público. O profile-scraper
// usa caminho diferente do Instagram e costuma funcionar nesses casos —
// limitado a ~30 posts em latestPosts mas suficiente pra >90% das contas.
const FALLBACK_ACTOR_ID = "apify~instagram-profile-scraper";
// Teto de segurança de posts por scrape. Com o filtro de data (onlyPostsNewerThan)
// o Apify já para cedo na maioria das contas, então isso raramente bate — fica só
// pra proteger conta que posta MUITO. Não baixar: truncaria o mês de quem posta 3+/dia.
const POSTS_LIMIT = 100;
// Folga (em dias) pra trás do início do mês. A coluna "Semana" conta desde a
// segunda-feira, que no começo do mês cai no mês anterior — sem essa folga a
// semana ficaria subestimada nos primeiros dias. 8 dias cobre o pior caso.
const FOLGA_SEMANA_DIAS = 8;
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

/**
 * Calcula a data (YYYY-MM-DD UTC) pra passar no `onlyPostsNewerThan` do Apify.
 * O actor para de baixar ao chegar num post mais antigo que essa data — então
 * em vez de puxar 100 posts (a maioria de meses passados, que não conta pra nada),
 * ele puxa só o que importa pras colunas Hoje/Semana/Mês. É daqui que vem a
 * economia de custo do Apify.
 *
 * A data = a MAIS ANTIGA entre (dia 1 do mês corrente) e (hoje − FOLGA_SEMANA_DIAS).
 * Usa início do mês em UTC (00:00), que é ~4h mais cedo que 00:00 Cuiabá — ou seja,
 * generoso de propósito: nunca corta um post que deveria contar.
 */
export function onlyPostsNewerThan(now: Date = new Date()): string {
  const inicioMesUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const folgaSemanaMs = now.getTime() - FOLGA_SEMANA_DIAS * 24 * 60 * 60 * 1000;
  const maisAntigo = Math.min(inicioMesUtcMs, folgaSemanaMs);
  return new Date(maisAntigo).toISOString().slice(0, 10);
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
        // Só posts recentes o bastante pra cobrir Hoje/Semana/Mês. O Apify para
        // de baixar ao passar dessa data → corta gasto com post velho inútil.
        onlyPostsNewerThan: onlyPostsNewerThan(),
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
 * Shape do item retornado pelo apify/instagram-profile-scraper (fallback).
 * Diferente do principal: vem 1 item por perfil com `latestPosts` aninhado.
 */
interface ApifyProfileItem {
  username?: string;
  postsCount?: number;
  latestPosts?: Array<{
    url?: string;
    shortCode?: string;
    timestamp?: string;
    type?: string;
    productType?: string;
  }>;
  error?: string;
}

/**
 * Fallback usando profile-scraper. Mesma interface de retorno, mas
 * usa shape e endpoint diferentes do actor principal. Cap de ~30 posts.
 */
async function scrapeOnceFallback(username: string, token: string): Promise<ProfileSnapshotResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = `${APIFY_BASE}/acts/${FALLBACK_ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [username],
      }),
      signal: controller.signal,
    });

    if (resp.status === 429) {
      return { status: "rate_limit", totalPosts: null, recentPosts: [], erro: "Rate limit Apify (fallback)" };
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return {
        status: "error",
        totalPosts: null,
        recentPosts: [],
        erro: `HTTP ${resp.status} (fallback): ${text.slice(0, 200)}`,
      };
    }

    const items = (await resp.json()) as ApifyProfileItem[];
    if (!Array.isArray(items) || items.length === 0) {
      return { status: "profile_not_found", totalPosts: null, recentPosts: [], erro: "no_items (fallback)" };
    }

    const profile = items[0];
    if (profile.error) {
      return { status: "profile_not_found", totalPosts: null, recentPosts: [], erro: profile.error };
    }

    const posts = profile.latestPosts ?? [];
    const recentPosts: PostRecente[] = posts
      .filter((p) => p.timestamp)
      .map((p) => {
        const u = p.url ?? (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : null);
        if (!u) return null;
        const tipo: PostType =
          p.productType === "clips" ? "reel" :
          p.type === "Video" && (!p.productType || p.productType === "clips") ? "reel" :
          "feed";
        return { url: u, timestamp: p.timestamp!, type: tipo };
      })
      .filter((p): p is PostRecente => p !== null);

    return {
      status: "ok",
      totalPosts: profile.postsCount ?? null,
      recentPosts,
    };
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || /aborted/i.test(err.message));
    if (isAbort) {
      return {
        status: "error",
        totalPosts: null,
        recentPosts: [],
        erro: `Apify (fallback) demorou mais de ${FETCH_TIMEOUT_MS / 1000}s pra responder.`,
      };
    }
    return {
      status: "error",
      totalPosts: null,
      recentPosts: [],
      erro: err instanceof Error ? `${err.message} (fallback)` : `${String(err)} (fallback)`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Faz scraping de UM perfil. Não persiste — só retorna o resultado.
 * Persistência é responsabilidade do caller (actions / cron).
 *
 * Estratégia:
 *   1. instagram-scraper (até 100 posts)
 *   2. Se transitório → retry após 3s
 *   3. Se ainda transitório → fallback pra instagram-profile-scraper (até 30 posts)
 *
 * O fallback custa +1 chamada Apify (só quando os 2 tries do principal falham).
 * Aceitável porque pra perfis que falham consistentemente no principal
 * (caso da Nazca), é a única forma de retornar dado.
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
  if (!isErroTransitorio(second)) return second;

  // Último recurso: actor diferente. Caso da Nazca — instagram-scraper
  // falha consistentemente mas profile-scraper consegue.
  return scrapeOnceFallback(username, token);
}
