import type { Conquista } from "./catalogo";
import type { StatsUsuario } from "./stats";

export interface ConquistaAvaliada extends Conquista {
  atual: number;
  desbloqueada: boolean;
  aplicavel: boolean;
}

export function avaliarConquistas(
  catalogo: Conquista[],
  stats: StatsUsuario,
  role: string,
): ConquistaAvaliada[] {
  return catalogo.map((c) => {
    const atual = stats[c.fonte] ?? 0;
    const aplicavel = !c.aplicavelRoles || c.aplicavelRoles.includes(role);
    return { ...c, atual, desbloqueada: atual >= c.alvo, aplicavel };
  });
}
