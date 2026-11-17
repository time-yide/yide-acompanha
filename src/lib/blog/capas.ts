// Regras de troca das capas do blog por fotos reais.

// Capas de IA ficam nessa pasta do Storage; só o pipeline antigo gravava nela.
const PASTA_CAPAS_IA = "/storage/v1/object/public/blog/capas/";

/** Capa de IA ou post sem capa. Foto do Pexels e capa colocada à mão ficam como estão. */
export function precisaTrocarCapa(url: string | null): boolean {
  return !url || url.includes(PASTA_CAPAS_IA);
}

export function escolherFotoNaoUsada(fotos: string[], usadas: Set<string>): string | null {
  return fotos.find((f) => !usadas.has(f)) ?? null;
}

/** Da busca mais específica pra mais ampla: keywords longas às vezes não têm resultado. */
export function consultasDeFoto(keywords: string[], titulo: string): string[] {
  return [...new Set([keywords.slice(0, 3).join(" "), keywords[0], titulo])].filter(Boolean);
}
