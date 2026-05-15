// Integração com Google Places API (New) — https://places.googleapis.com/v1
//
// A Yide fornece `GOOGLE_PLACES_API_KEY` no env. Pra cada cliente, assessor
// cola um link do Google Maps na ficha do cliente. Esta lib resolve esse
// link em um `place_id` canônico via Places API text search, depois usa o
// place_id pra buscar rating/userRatingCount diariamente via cron.
//
// Sem a env var, modo automático fica desabilitado (funções retornam null)
// e sistema cai pro modo manual (assessor digita números).
//
// Quota: free tier dá ~10k searches/mês. Cada update de cliente consome
// 1 chamada. Pra ~50 clientes refreshing diariamente = ~1500/mês, bem
// abaixo do free tier.

const PLACES_API_BASE = "https://places.googleapis.com/v1";

export interface GmbPlaceData {
  /** Place ID canônico do Google ("ChIJ..."). */
  placeId: string;
  /** Nome do local ("Gallo Vila Madalena"). */
  name: string;
  /** Nota média 0-5 ou null se sem reviews. */
  rating: number | null;
  /** Total de avaliações ou null. */
  reviewCount: number | null;
  /** URL canônica do Google Maps (substitui a que usuário colou). */
  mapsUrl: string;
  /** Endereço formatado ou null. */
  formattedAddress: string | null;
}

/**
 * Resolve uma URL do Google Maps (qualquer formato — long, short, place URL,
 * etc.) em dados do place. Funciona usando o text search da Places API New
 * passando a URL inteira como query — Google tem boa heurística pra resolver.
 *
 * Retorna null em:
 * - Falta de GOOGLE_PLACES_API_KEY (modo manual fallback)
 * - URL não resolve em nenhum lugar
 * - Erro de rede / quota
 */
export async function fetchGmbByUrl(url: string, apiKey: string): Promise<GmbPlaceData | null> {
  if (!apiKey) return null;
  try {
    const response = await fetch(`${PLACES_API_BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: url, maxResultCount: 1 }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[gmb-places] searchText failed:", response.status, errText);
      return null;
    }
    const data = (await response.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text: string };
        rating?: number;
        userRatingCount?: number;
        googleMapsUri?: string;
        formattedAddress?: string;
      }>;
    };
    const place = data.places?.[0];
    if (!place?.id) return null;
    return {
      placeId: place.id,
      name: place.displayName?.text ?? "",
      rating: typeof place.rating === "number" ? place.rating : null,
      reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
      mapsUrl: place.googleMapsUri ?? url,
      formattedAddress: place.formattedAddress ?? null,
    };
  } catch (e) {
    console.error("[gmb-places] fetchByUrl threw:", e);
    return null;
  }
}

/**
 * Refresh de dados de um place já conhecido (via place_id). Usado pelo cron
 * diário. Mais barato que searchText — endpoint direto de detail.
 */
export async function fetchGmbByPlaceId(placeId: string, apiKey: string): Promise<GmbPlaceData | null> {
  if (!apiKey || !placeId) return null;
  try {
    const response = await fetch(`${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,rating,userRatingCount,googleMapsUri,formattedAddress",
      },
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[gmb-places] place details failed:", response.status, errText);
      return null;
    }
    const place = (await response.json()) as {
      id: string;
      displayName?: { text: string };
      rating?: number;
      userRatingCount?: number;
      googleMapsUri?: string;
      formattedAddress?: string;
    };
    if (!place.id) return null;
    return {
      placeId: place.id,
      name: place.displayName?.text ?? "",
      rating: typeof place.rating === "number" ? place.rating : null,
      reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
      mapsUrl: place.googleMapsUri ?? "",
      formattedAddress: place.formattedAddress ?? null,
    };
  } catch (e) {
    console.error("[gmb-places] fetchByPlaceId threw:", e);
    return null;
  }
}
