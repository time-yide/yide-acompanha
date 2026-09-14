// src/lib/design/image-gen/tipos.ts

/** Tamanhos suportados pelo gpt-image-1. */
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

/** Mapeia o formato da canvas pro tamanho de geração. Retrato pra story/reels. */
export function sizeParaFormato(formato: string): ImageSize {
  if (formato === "story" || formato === "reels") return "1024x1536";
  return "1024x1024";
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
