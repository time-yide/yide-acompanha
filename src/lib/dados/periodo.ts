import type { Periodo } from "./tipos";

const DIA = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD no fuso de São Paulo. */
export function ymdSP(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}
function addDias(ymd: string, n: number): string {
  const t = new Date(`${ymd}T12:00:00Z`).getTime() + n * DIA;
  return new Date(t).toISOString().slice(0, 10);
}

/** 30 dias completos terminando ontem (hoje ainda está incompleto). */
export function periodoPadrao(agora: Date = new Date()): Periodo {
  const ontem = addDias(ymdSP(agora), -1);
  return { de: addDias(ontem, -29), ate: ontem };
}

export function periodoAnterior(p: Periodo): Periodo {
  const dur = Math.round((new Date(`${p.ate}T12:00:00Z`).getTime() - new Date(`${p.de}T12:00:00Z`).getTime()) / DIA);
  const ate = addDias(p.de, -1);
  return { de: addDias(ate, -dur), ate };
}

export function diasEntre(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DIA);
}
