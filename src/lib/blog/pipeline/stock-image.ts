import "server-only";

interface PexelsPhoto {
  id: number;
  src: { large2x: string; large: string; medium: string };
  alt: string;
  photographer: string;
}

interface PexelsResponse {
  photos: PexelsPhoto[];
}

export async function buscarImagemStock(
  keywords: string[],
): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.log("[blog] PEXELS_API_KEY não configurada");
    return null;
  }

  const query = keywords.slice(0, 3).join(" ");

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&locale=pt-BR`,
      { headers: { Authorization: apiKey } },
    );

    if (!res.ok) {
      console.error("[blog] Pexels error:", res.status);
      return null;
    }

    const data: PexelsResponse = await res.json();
    if (!data.photos || data.photos.length === 0) return null;

    const idx = Math.floor(Math.random() * Math.min(data.photos.length, 3));
    return data.photos[idx].src.large2x || data.photos[idx].src.large;
  } catch (err) {
    console.error("[blog] Pexels fetch error:", err);
    return null;
  }
}
