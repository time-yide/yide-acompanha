// src/components/design/studio/exportCanvas.ts
"use client";

import { toPng } from "html-to-image";

/**
 * Renderiza o elemento da canvas (já no tamanho real do formato) em PNG.
 * Espera as fontes custom carregarem antes de capturar, pra não exportar
 * com fonte fallback.
 */
export async function exportarCanvasPng(el: HTMLElement, dims: { w: number; h: number }): Promise<string> {
  if (typeof document !== "undefined" && "fonts" in document) {
    try { await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready; } catch { /* ignore */ }
  }
  return toPng(el, {
    width: dims.w,
    height: dims.h,
    pixelRatio: 1,
    cacheBust: true,
    style: { transform: "none", transformOrigin: "top left" },
  });
}
