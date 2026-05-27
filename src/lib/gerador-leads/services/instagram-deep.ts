// SERVER ONLY - Instagram-deep: tenta inferir o perfil pessoal do dono
// da empresa, usando os dados do perfil corporativo do Instagram + nome
// do sócio da Receita Federal pra cruzar.
//
// Estratégia:
// 1. Pega últimos posts do @empresaUsername (apify/instagram-profile-scraper)
// 2. Extrai @ mencionados em captions + taggedUsers, conta frequência
// 3. Pega top 3 candidatos e busca o perfil deles pra comparar fullName
//    com `decisorNome` via similarity()
// 4. Retorna melhor match com confidence baseado em similaridade + frequência
//
// Sem APIFY_API_TOKEN ou sem empresaUsername/decisorNome → retorna EMPTY.

import { getServerEnv } from "@/lib/env";
import { similarity } from "../utils/string-match";

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-profile-scraper";
const FETCH_TIMEOUT_MS = 60_000;
const MAX_CANDIDATES = 3;

export interface OwnerInstagramResult {
  username: string | null;
  bio: string | null;
  telefone_no_bio: string | null;
  link_no_bio: string | null;
  confidence: "alta" | "media" | "baixa" | null;
}

const EMPTY: OwnerInstagramResult = {
  username: null,
  bio: null,
  telefone_no_bio: null,
  link_no_bio: null,
  confidence: null,
};

/**
 * Normaliza username (remove @, URL, slashes).
 */
function normalizeUsername(input: string): string {
  let user = input.trim();
  if (user.startsWith("@")) user = user.slice(1);
  const urlMatch = user.match(/instagram\.com\/([^/?#]+)/i);
  if (urlMatch) user = urlMatch[1];
  return user.replace(/\/$/, "").toLowerCase();
}

/**
 * Tenta encontrar o Instagram pessoal do decisor da empresa.
 *
 * @param empresaUsername - Username do IG corporativo (sem @)
 * @param decisorNome - Nome do decisor (do CNPJá idealmente; pode ser null)
 */
export async function findOwnerInstagram(
  empresaUsername: string | null | undefined,
  decisorNome: string | null | undefined,
): Promise<OwnerInstagramResult> {
  if (!empresaUsername?.trim() || !decisorNome?.trim()) return EMPTY;

  const env = getServerEnv();
  const token = env.APIFY_API_TOKEN;
  if (!token) return EMPTY;

  const empresa = normalizeUsername(empresaUsername);
  if (!empresa) return EMPTY;

  const url = `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  try {
    // 1) Busca últimos posts da empresa pra coletar @ mencionados
    const postsResp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [empresa],
        resultsLimit: 10,
        resultsType: "posts",
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!postsResp.ok) return EMPTY;

    const items = (await postsResp.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(items) || items.length === 0) return EMPTY;

    // 2) Coleta candidatos: @ em captions + taggedUsers
    const mentionCounts = new Map<string, number>();
    for (const post of items) {
      const caption = typeof post.caption === "string" ? post.caption : "";
      const matches = caption.match(/@([a-zA-Z0-9._]+)/g) ?? [];
      for (const m of matches) {
        const handle = m.slice(1).toLowerCase();
        if (!handle || handle === empresa) continue;
        mentionCounts.set(handle, (mentionCounts.get(handle) ?? 0) + 1);
      }
      const tagged = Array.isArray(post.taggedUsers)
        ? (post.taggedUsers as Array<Record<string, unknown>>)
        : [];
      for (const t of tagged) {
        const raw = typeof t.username === "string" ? t.username : "";
        const handle = raw.toLowerCase();
        if (!handle || handle === empresa) continue;
        mentionCounts.set(handle, (mentionCounts.get(handle) ?? 0) + 1);
      }
    }

    if (mentionCounts.size === 0) return EMPTY;

    // 3) Top N candidatos: busca perfil de cada e compara nome
    const sorted = [...mentionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CANDIDATES);

    let bestMatch:
      | { username: string; similarityScore: number; mentions: number; bio: string; fullName: string }
      | null = null;

    for (const [handle, mentions] of sorted) {
      const profileResp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: [handle],
          resultsLimit: 1,
          addParentData: false,
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!profileResp.ok) continue;

      const profileData = (await profileResp.json()) as Array<Record<string, unknown>>;
      const profile = profileData?.[0];
      if (!profile) continue;

      const fullName = typeof profile.fullName === "string" ? profile.fullName : "";
      const bio = typeof profile.biography === "string" ? profile.biography : "";
      const score = similarity(fullName, decisorNome);
      if (!bestMatch || score > bestMatch.similarityScore) {
        bestMatch = { username: handle, similarityScore: score, mentions, bio, fullName };
      }
    }

    if (!bestMatch) return EMPTY;

    // 4) Confidence baseado em similarity + mentions
    let confidence: OwnerInstagramResult["confidence"] = "baixa";
    if (bestMatch.similarityScore >= 0.8 && bestMatch.mentions >= 3) {
      confidence = "alta";
    } else if (bestMatch.similarityScore >= 0.5 || bestMatch.mentions >= 3) {
      confidence = "media";
    }

    // Telefone BR no bio: (XX) XXXXX-XXXX, +55..., etc.
    const phoneMatch = bestMatch.bio.match(
      /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-.\s]?\d{4}/,
    );
    const telefone_no_bio = phoneMatch ? phoneMatch[0].replace(/[^\d+]/g, "") : null;

    // Primeira URL completa no bio
    const linkMatch = bestMatch.bio.match(/https?:\/\/[^\s)]+/);
    const link_no_bio = linkMatch ? linkMatch[0] : null;

    return {
      username: bestMatch.username,
      bio: bestMatch.bio || null,
      telefone_no_bio,
      link_no_bio,
      confidence,
    };
  } catch {
    return EMPTY;
  }
}
