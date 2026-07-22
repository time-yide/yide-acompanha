import { DEGRAUS, SKILLS_POR_CARGO, SKILLS_POR_TEMPERAMENTO, type SkillDef, type FonteSkill } from "./catalogo";
import type { StatsUsuario } from "@/lib/conquistas/stats";

export interface SkillDerivada {
  nome: string;
  icone: string;
  nivel: number;            // 1..5
  atual: number;            // valor da fonte
  alvoProx: number | null;  // valor pro próximo nível (null = nível máximo)
  pctProx: number;          // 0..100
}

function valorDaFonte(fonte: FonteSkill, stats: StatsUsuario): number {
  if (fonte === "xpGeral") return Math.max(0, stats.mesesDeCasa) + stats.tarefasConcluidas;
  return stats[fonte] ?? 0;
}

function calcularNivel(degraus: number[], valor: number): { nivel: number; alvoProx: number | null; pctProx: number } {
  let passou = 0;
  for (const d of degraus) if (valor >= d) passou++;
  const nivel = Math.min(Math.max(1, passou), degraus.length);
  if (nivel >= degraus.length) return { nivel, alvoProx: null, pctProx: 100 };
  const base = degraus[nivel - 1];
  const prox = degraus[nivel];
  const pctProx = prox > base ? Math.min(100, Math.max(0, Math.round(((valor - base) / (prox - base)) * 100))) : 0;
  return { nivel, alvoProx: prox, pctProx };
}

export function derivarSkills(role: string, classe: string | null, stats: StatsUsuario): SkillDerivada[] {
  const defs: SkillDef[] = [
    ...(SKILLS_POR_CARGO[role] ?? []),
    ...(classe ? SKILLS_POR_TEMPERAMENTO[classe] ?? [] : []),
  ];
  const vistos = new Set<string>();
  const out: SkillDerivada[] = [];
  for (const d of defs) {
    if (vistos.has(d.nome)) continue;
    vistos.add(d.nome);
    const valor = valorDaFonte(d.fonte, stats);
    const { nivel, alvoProx, pctProx } = calcularNivel(DEGRAUS[d.fonte], valor);
    out.push({ nome: d.nome, icone: d.icone, nivel, atual: valor, alvoProx, pctProx });
  }
  return out;
}
