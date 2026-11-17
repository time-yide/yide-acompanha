import "server-only";
import { consultasDeFoto, escolherFotoNaoUsada } from "../capas";

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

export type FotoParaCapa = { url: string } | { limite: true } | { semFoto: true };

/** Foto que ainda não está em outro post. `limite` = Pexels bloqueou (200 buscas por hora). */
export async function buscarFotoParaCapa(
  keywords: string[],
  titulo: string,
  usadas: Set<string>,
): Promise<FotoParaCapa> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.log("[blog] PEXELS_API_KEY não configurada");
    return { semFoto: true };
  }

  for (const query of consultasDeFoto(keywords, titulo)) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=30&orientation=landscape&locale=pt-BR`,
        { headers: { Authorization: apiKey } },
      );
      if (res.status === 429) return { limite: true };
      if (!res.ok) {
        console.error("[blog] Pexels error:", res.status);
        continue;
      }
      const data: PexelsResponse = await res.json();
      const fotos = (data.photos ?? []).map((p) => p.src.large2x || p.src.large);
      const url = escolherFotoNaoUsada(fotos, usadas);
      if (url) return { url };
    } catch (err) {
      console.error("[blog] Pexels fetch error:", err);
    }
  }
  return { semFoto: true };
}
