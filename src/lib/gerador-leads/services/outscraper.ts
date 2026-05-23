// SERVER ONLY - wrapper do Outscraper Google Maps API
//
// Docs: https://app.outscraper.com/api-docs#tag/Google/operation/google-maps-search-v3
//
// Endpoint que usamos: /maps/search-v3 (sync, retorna direto até 500 resultados)
// - sync=true bloqueia até a busca terminar (timeout ~5 min)
// - async=true retorna request_id pra polling - usaremos na Fase 2 quando
//   tivermos cron pra processar buscas grandes
//
// Rate limit: Outscraper free tier permite ~5 req/min. Implementamos retry
// com backoff exponencial pra requests 429.

import { getServerEnv } from "@/lib/env";

const OUTSCRAPER_BASE = "https://api.outscraper.com";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

export interface OutscraperPlaceRaw {
  query?: string;
  name?: string;
  type?: string;
  subtypes?: string;
  category?: string;
  full_address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  site?: string;
  rating?: number;
  reviews?: number;
  description?: string;
  working_hours?: Record<string, string> | string;
  about?: Record<string, unknown>;
  business_status?: string;
  place_id?: string;
  google_id?: string;
  cid?: string;
  reviews_link?: string;
  // Redes sociais - Outscraper tenta extrair
  email_1?: string;
  email_2?: string;
  email_3?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
  whatsapp?: string;
  // URL no Google Maps
  located_in?: string;
  link?: string;
  reviews_id?: string;
  // Outros campos retornados (deixa flexível)
  [key: string]: unknown;
}

export interface OutscraperSearchOk {
  ok: true;
  /** Request ID retornado pelo Outscraper (útil pra debug). */
  requestId: string | null;
  results: OutscraperPlaceRaw[];
}

export interface OutscraperSearchError {
  ok: false;
  error: string;
  /** Quando true, dá pra tentar de novo (rate limit / network). */
  retryable: boolean;
}

export type OutscraperSearchResult = OutscraperSearchOk | OutscraperSearchError;

interface SearchParams {
  query: string;        // ex: "energia solar em Cuiabá"
  limit: number;        // 1-500
  language?: string;    // 'pt' por default
  region?: string;      // 'BR' por default
}

/** Sleep helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Faz busca síncrona no Outscraper Google Maps. Retorna até 500 resultados.
 *
 * Comportamento:
 * - Sem `OUTSCRAPER_API_KEY` configurada → retorna erro claro pedindo setup
 * - Sucesso → retorna array de places
 * - HTTP 429 (rate limit) → retry exponencial até 3x
 * - HTTP 4xx (exceto 429) → erro não-retryable
 * - HTTP 5xx → retry exponencial até 3x
 * - Network error → retry exponencial até 3x
 */
export async function searchGoogleMaps(params: SearchParams): Promise<OutscraperSearchResult> {
  const env = getServerEnv();
  const apiKey = env.OUTSCRAPER_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      retryable: false,
      error: "OUTSCRAPER_API_KEY não configurada. Crie conta em app.outscraper.com → Settings → API Keys e adiciona no Vercel.",
    };
  }

  const limit = Math.max(1, Math.min(500, Math.floor(params.limit ?? 20)));
  const url = new URL(`${OUTSCRAPER_BASE}/maps/search-v3`);
  url.searchParams.set("query", params.query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("language", params.language ?? "pt");
  url.searchParams.set("region", params.region ?? "BR");
  // async=false = bloqueia até terminar e retorna direto. Bom pra <50 resultados.
  url.searchParams.set("async", "false");
  // Inclui campos extras
  url.searchParams.set("fields", "");

  let lastError = "Erro desconhecido";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "X-API-KEY": apiKey,
          Accept: "application/json",
        },
        // 5 min timeout - pesquisa grande pode demorar
        signal: AbortSignal.timeout(5 * 60 * 1000),
      });

      // 429 ou 5xx → retry com backoff
      if (resp.status === 429 || resp.status >= 500) {
        lastError = `HTTP ${resp.status}: ${resp.statusText}`;
        if (attempt < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[outscraper] ${lastError} - retry em ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(delay);
          continue;
        }
        return { ok: false, retryable: true, error: lastError };
      }

      // 4xx (exceto 429) → erro definitivo
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        return {
          ok: false,
          retryable: false,
          error: `HTTP ${resp.status}: ${body || resp.statusText}`,
        };
      }

      // 200 OK
      const data = await resp.json() as {
        id?: string;
        status?: string;
        data?: OutscraperPlaceRaw[][] | OutscraperPlaceRaw[];
      };

      // Outscraper retorna `data: [[ ...results ]]` (array de arrays - 1 array por query)
      // Quando passa só 1 query, vem `data[0]` com os resultados
      let results: OutscraperPlaceRaw[] = [];
      if (Array.isArray(data.data)) {
        if (data.data.length > 0 && Array.isArray(data.data[0])) {
          results = (data.data[0] as OutscraperPlaceRaw[]) ?? [];
        } else {
          results = data.data as OutscraperPlaceRaw[];
        }
      }

      return {
        ok: true,
        requestId: data.id ?? null,
        results,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[outscraper] network error: ${lastError} - retry em ${delay}ms`);
        await sleep(delay);
        continue;
      }
    }
  }

  return { ok: false, retryable: true, error: lastError };
}

// =============================================================================
// Helpers de normalização - converte raw Outscraper → schema do nosso DB
// =============================================================================

/**
 * Extrai domínio "limpo" de uma URL.
 * "https://www.empresa.com.br/contato" → "empresa.com.br"
 */
export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Limpa telefone - remove espaços, traços, parênteses; mantém + inicial.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned || null;
}

/**
 * Normaliza @ do Instagram.
 * "https://instagram.com/empresa/" → "empresa"
 * "@empresa" → "empresa"
 */
export function normalizeInstagram(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.trim();
  if (!v) return null;
  // URL completa
  const m = v.match(/instagram\.com\/([^/?#]+)/i);
  if (m) v = m[1];
  // Remove @ e barras
  v = v.replace(/^@/, "").replace(/\/$/, "");
  return v.toLowerCase() || null;
}

/**
 * Detecta WhatsApp em um valor que pode ser URL wa.me ou número.
 */
export function extractWhatsapp(
  whatsappField: string | null | undefined,
  phoneField: string | null | undefined,
): string | null {
  if (whatsappField) {
    const m = whatsappField.match(/wa\.me\/(\d+)/i);
    if (m) return `+${m[1]}`;
    const cleaned = whatsappField.replace(/[^\d+]/g, "");
    if (cleaned) return cleaned;
  }
  // Fallback: usa o telefone (no Brasil, móveis quase sempre têm WhatsApp)
  return normalizePhone(phoneField);
}

/**
 * Formata working_hours pra string legível.
 */
export function formatWorkingHours(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, string>);
    if (entries.length === 0) return null;
    return entries.map(([day, hours]) => `${day}: ${hours}`).join(" · ");
  }
  return null;
}

/**
 * Normaliza um resultado raw do Outscraper pro schema do nosso `leads_gerados`.
 * Retorna null se não tiver nem nome de empresa (resultado lixo).
 */
export interface NormalizedLead {
  empresa: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  dominio: string | null;
  instagram: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  pais: string;
  categoria: string | null;
  horario_funcionamento: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  raw_data: OutscraperPlaceRaw;
}

export function normalizeOutscraperPlace(raw: OutscraperPlaceRaw): NormalizedLead | null {
  const empresa = (raw.name ?? "").trim();
  if (!empresa) return null;

  const email = raw.email_1 ?? raw.email_2 ?? raw.email_3 ?? null;
  const placeId = raw.place_id ?? raw.google_id ?? null;

  return {
    empresa,
    telefone: normalizePhone(raw.phone),
    whatsapp: extractWhatsapp(raw.whatsapp, raw.phone),
    email: email && email.trim() ? email.trim().toLowerCase() : null,
    website: raw.site ?? null,
    dominio: extractDomain(raw.site),
    instagram: normalizeInstagram(raw.instagram),
    endereco: raw.full_address ?? null,
    cidade: raw.city ?? null,
    estado: raw.state ?? null,
    pais: raw.country ?? "BR",
    categoria: raw.category ?? raw.type ?? raw.subtypes ?? null,
    horario_funcionamento: formatWorkingHours(raw.working_hours),
    google_rating: typeof raw.rating === "number" ? raw.rating : null,
    google_reviews_count: typeof raw.reviews === "number" ? raw.reviews : null,
    google_place_id: placeId,
    google_maps_url: raw.link ?? null,
    latitude: typeof raw.latitude === "number" ? raw.latitude : null,
    longitude: typeof raw.longitude === "number" ? raw.longitude : null,
    raw_data: raw,
  };
}
