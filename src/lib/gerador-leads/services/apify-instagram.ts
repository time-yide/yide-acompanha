// SERVER ONLY — wrapper do Apify Instagram Profile Scraper
//
// Actor usado: apify/instagram-profile-scraper
// Docs: https://apify.com/apify/instagram-profile-scraper
//
// Estratégia:
// - Usa "run-sync-get-dataset-items" pra rodar o actor e pegar resultado direto
// - Timeout 90s (Instagram às vezes demora pra responder)
// - Sem APIFY_API_TOKEN → retorna { skipped: true }
//
// Custo: ~$0.30 a cada 100 perfis. Free tier ($5/mês) dá ~1500 perfis.

import { getServerEnv } from "@/lib/env";

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-profile-scraper";
const FETCH_TIMEOUT_MS = 90_000;

export interface InstagramProfileResult {
  ok: boolean;
  skipped: boolean;
  error: string | null;
  username: string | null;
  fullName: string | null;
  bio: string | null;
  url: string | null;
  followersCount: number | null;
  followsCount: number | null;
  postsCount: number | null;
  isBusinessAccount: boolean | null;
  isVerified: boolean | null;
  businessCategoryName: string | null;
  externalUrl: string | null;
  /** True se o último post foi nos últimos 60 dias (heurística "ativo"). */
  ativo: boolean | null;
  /** Email/WhatsApp/contato detectado na bio (regex local). */
  emailNaBio: string | null;
  whatsappNaBio: string | null;
  /** Nome próprio detectado na bio (heurística). */
  nomeNaBio: string | null;
}

const empty: InstagramProfileResult = {
  ok: false,
  skipped: false,
  error: null,
  username: null,
  fullName: null,
  bio: null,
  url: null,
  followersCount: null,
  followsCount: null,
  postsCount: null,
  isBusinessAccount: null,
  isVerified: null,
  businessCategoryName: null,
  externalUrl: null,
  ativo: null,
  emailNaBio: null,
  whatsappNaBio: null,
  nomeNaBio: null,
};

/**
 * Extrai email da bio.
 */
function extractEmail(text: string): string | null {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m?.[0]?.toLowerCase() ?? null;
}

/**
 * Extrai possível WhatsApp da bio (formato BR).
 */
function extractWhats(text: string): string | null {
  // Padrões comuns: "(65) 99999-9999", "WhatsApp 65 99999-9999", etc.
  const m = text.match(/(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-.\s]?\d{4}/);
  if (!m) return null;
  return m[0].replace(/[^\d+]/g, "");
}

/**
 * Heurística: tenta achar nome próprio em bio.
 * Bios típicas de empresa BR: "Maria Souza • Designer" / "Por João Silva 🌟"
 */
function extractNome(text: string): string | null {
  // Captura até 3 palavras com letra maiúscula seguidas
  const m = text.match(/(?:^|\b)((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+\s){1,2}[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)/);
  if (!m) return null;
  const candidate = m[1].trim();
  // Filtra palavras que parecem nome de empresa (terminam com Ltda, Solar, etc)
  const stopWords = ["Ltda", "Solar", "Energia", "Brasil", "Cuiabá", "Marketing", "Digital"];
  if (stopWords.some((w) => candidate.includes(w))) return null;
  return candidate;
}

export async function scrapeInstagramProfile(
  username: string | null | undefined,
): Promise<InstagramProfileResult> {
  const result: InstagramProfileResult = { ...empty };

  if (!username || !username.trim()) {
    result.error = "Username vazio";
    return result;
  }

  const env = getServerEnv();
  const token = env.APIFY_API_TOKEN;
  if (!token) {
    result.skipped = true;
    return result;
  }

  // Normaliza username (remove @, URLs, slashes)
  let user = username.trim();
  if (user.startsWith("@")) user = user.slice(1);
  const urlMatch = user.match(/instagram\.com\/([^/?#]+)/i);
  if (urlMatch) user = urlMatch[1];
  user = user.replace(/\/$/, "");
  if (!user) {
    result.error = "Username inválido";
    return result;
  }
  result.username = user;
  result.url = `https://instagram.com/${user}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // run-sync-get-dataset-items: roda actor e retorna resultados sem precisar polling
    const url = `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [user],
        resultsLimit: 1,
        // Não baixa posts/stories — só o perfil em si (mais barato + rápido)
        addParentData: false,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      result.error = `HTTP ${resp.status}: ${text.slice(0, 200)}`;
      return result;
    }

    const items = await resp.json() as Array<Record<string, unknown>>;
    if (!Array.isArray(items) || items.length === 0) {
      result.error = "Perfil não encontrado ou privado";
      return result;
    }

    const profile = items[0];
    result.ok = true;
    result.fullName = (profile.fullName as string) ?? null;
    result.bio = (profile.biography as string) ?? null;
    result.followersCount = (profile.followersCount as number) ?? null;
    result.followsCount = (profile.followsCount as number) ?? null;
    result.postsCount = (profile.postsCount as number) ?? null;
    result.isBusinessAccount = (profile.isBusinessAccount as boolean) ?? null;
    result.isVerified = (profile.verified as boolean) ?? null;
    result.businessCategoryName = (profile.businessCategoryName as string) ?? null;
    result.externalUrl = (profile.externalUrl as string) ?? null;

    // Detecta atividade pela data do último post (se vier no resultado)
    const latestPosts = profile.latestPosts as Array<{ timestamp?: string }> | undefined;
    if (latestPosts && latestPosts.length > 0) {
      const ts = latestPosts[0].timestamp;
      if (ts) {
        const lastDate = new Date(ts);
        const ageDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        result.ativo = ageDays <= 60;
      }
    }

    // Extrai email/WhatsApp/nome da bio
    if (result.bio) {
      result.emailNaBio = extractEmail(result.bio);
      result.whatsappNaBio = extractWhats(result.bio);
      result.nomeNaBio = extractNome(result.bio);
    }

    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  } finally {
    clearTimeout(timer);
  }
}
