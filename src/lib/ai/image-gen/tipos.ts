// src/lib/design/image-gen/tipos.ts

/** Tamanhos suportados pelo gpt-image-1. */
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

/** Mapeia o formato da arte pro tamanho de geração. */
export function sizeParaFormato(formato: string): ImageSize {
  switch (formato) {
    case "story":
    case "reels":
      return "1024x1536";
    case "banner":
    case "capa_site":
    case "capa_youtube":
    case "thumbnail":
    case "capa_facebook":
    case "apresentacao":
      return "1536x1024";
    case "feed":
    case "carrossel":
    default:
      return "1024x1024";
  }
}

export function formatoLabel(formato: string): string {
  switch (formato) {
    case "feed": return "quadrado (1:1)";
    case "story": return "vertical (9:16)";
    case "carrossel": return "quadrado (1:1, carrossel)";
    case "banner": return "horizontal (banner)";
    case "capa_site": return "horizontal (capa de site)";
    case "capa_youtube": return "horizontal (capa YouTube)";
    case "thumbnail": return "horizontal (thumbnail)";
    case "capa_facebook": return "horizontal (capa Facebook)";
    case "apresentacao": return "horizontal (apresentação)";
    default: return "quadrado (1:1)";
  }
}

export interface GerarImagemParams {
  prompt: string;
  size: ImageSize;
  quality?: "low" | "medium" | "high";
}

export interface GerarImagemResult {
  ok: boolean;
  /** PNG em base64 (sem prefixo data:) quando ok. */
  b64?: string;
  error?: string;
}
