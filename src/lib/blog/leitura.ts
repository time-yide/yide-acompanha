// Estimativa de tempo de leitura (pura, testável). ~200 palavras/min, mínimo 1 min.
export function tempoLeituraMin(md: string): number {
  const palavras = (md || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}
