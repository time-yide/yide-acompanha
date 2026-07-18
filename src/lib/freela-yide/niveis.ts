// src/lib/freela-yide/niveis.ts
// Sistema de níveis por XP acumulado (todos os tempos). Função pura, sem IO.
// XP = total de pontos de todos os tempos (o `pontos` da entrada em historico.geral).

export interface FaixaNivel {
  nivel: number;
  titulo: string;
  xpMin: number;
  cor: string; // classes tailwind pro selo
}

// Curva difícil: cada faixa alta custa mais que o dobro da anterior.
export const NIVEIS: FaixaNivel[] = [
  { nivel: 1, titulo: "Novato",   xpMin: 0,    cor: "border-zinc-400/40 bg-zinc-500/10 text-zinc-300" },
  { nivel: 2, titulo: "Promessa", xpMin: 100,  cor: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300" },
  { nivel: 3, titulo: "Craque",   xpMin: 300,  cor: "border-sky-400/40 bg-sky-500/15 text-sky-300" },
  { nivel: 4, titulo: "Fera",     xpMin: 700,  cor: "border-violet-400/50 bg-violet-500/15 text-violet-200" },
  { nivel: 5, titulo: "Lenda",    xpMin: 1500, cor: "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200" },
  { nivel: 6, titulo: "Mito",     xpMin: 3500, cor: "border-amber-400/50 bg-amber-500/15 text-amber-200" },
];

export interface Nivel {
  nivel: number;
  titulo: string;
  cor: string;
  xpAtual: number;
  xpBase: number;
  xpProximo: number | null;     // null no Mito (nível máximo)
  proximoTitulo: string | null; // null no Mito
  faltam: number;               // pts pro próximo nível; 0 no Mito
  pct: number;                  // 0..100 dentro do nível atual; 100 no Mito
}

export function nivelDeXP(xp: number): Nivel {
  const x = Math.max(0, Math.floor(xp));
  let idx = 0;
  for (let i = 0; i < NIVEIS.length; i++) {
    if (x >= NIVEIS[i].xpMin) idx = i;
  }
  const atual = NIVEIS[idx];
  const prox = NIVEIS[idx + 1] ?? null;
  if (!prox) {
    return {
      nivel: atual.nivel, titulo: atual.titulo, cor: atual.cor,
      xpAtual: x, xpBase: atual.xpMin, xpProximo: null, proximoTitulo: null, faltam: 0, pct: 100,
    };
  }
  const span = prox.xpMin - atual.xpMin;
  const dentro = x - atual.xpMin;
  const pct = Math.max(0, Math.min(100, Math.round((dentro / span) * 100)));
  return {
    nivel: atual.nivel, titulo: atual.titulo, cor: atual.cor,
    xpAtual: x, xpBase: atual.xpMin, xpProximo: prox.xpMin, proximoTitulo: prox.titulo,
    faltam: Math.max(0, prox.xpMin - x), pct,
  };
}
