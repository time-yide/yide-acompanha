// src/lib/freela-yide/rivalidade.ts
// Quem está logo acima de você no ranking do MÊS corrente. Função pura, sem IO.
import type { RankingEntry } from "./queries";

export type Rival =
  | { tipo: "lider" }
  | { tipo: "foraDoRanking" }
  | { tipo: "perseguindo"; nome: string; faltam: number };

/** `ranking` já vem ordenado por pontos desc (contrato do getRanking). Não reordena. */
export function calcularRival(ranking: RankingEntry[], meId: string): Rival {
  const idx = ranking.findIndex((r) => r.user_id === meId);
  if (idx < 0) return { tipo: "foraDoRanking" };
  if (idx === 0) return { tipo: "lider" };
  const acima = ranking[idx - 1];
  const eu = ranking[idx];
  return { tipo: "perseguindo", nome: acima.nome, faltam: Math.max(0, acima.pontos - eu.pontos) };
}
