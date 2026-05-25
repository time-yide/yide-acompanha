// src/lib/instagram-snapshots/counts.ts
//
// Funções puras pra computar contagens de posts dentro de janelas de
// tempo no fuso da app (Cuiabá UTC-4). Sem deps externas.
import { getDatePartsInAppTz, APP_TIMEZONE } from "@/lib/datetime/timezone";
import type { CountsBucket, PostRecente } from "./tipos";

/**
 * Retorna o "início do dia" em Cuiabá (00:00 local) como um Date UTC.
 * Ex: now = 2026-05-15T14:00Z → 2026-05-15T04:00Z (00:00 Cuiabá UTC-4).
 */
function startOfDayCuiaba(ref: Date): Date {
  const parts = getDatePartsInAppTz(ref);
  // parts.year/month/day estão no fuso da app. Constrói 00:00 local somando offset.
  // Cuiabá é UTC-4 fixo → 00:00 local = 04:00 UTC do mesmo dia.
  return new Date(`${parts.year}-${parts.month}-${parts.day}T04:00:00.000Z`);
}

/**
 * Início da semana (segunda 00:00 Cuiabá) como Date UTC.
 */
function startOfWeekCuiaba(ref: Date): Date {
  const dayStart = startOfDayCuiaba(ref);
  // getDay no horário Cuiabá: precisamos do dia da semana NO FUSO da app.
  // Como dayStart é 04:00Z e UTC=04:00 não cruza meia-noite Cuiabá nem UTC,
  // dá pra usar getUTCDay direto: a 04:00Z, o dia UTC = dia Cuiabá.
  const dow = dayStart.getUTCDay(); // 0=dom, 1=seg, ..., 6=sab
  const diasDesdeSegunda = dow === 0 ? 6 : dow - 1;
  const seg = new Date(dayStart);
  seg.setUTCDate(seg.getUTCDate() - diasDesdeSegunda);
  return seg;
}

/**
 * Início do mês (dia 1 00:00 Cuiabá) como Date UTC.
 */
function startOfMonthCuiaba(ref: Date): Date {
  const parts = getDatePartsInAppTz(ref);
  return new Date(`${parts.year}-${parts.month}-01T04:00:00.000Z`);
}

export function computeCounts(posts: PostRecente[], now: Date = new Date()): CountsBucket {
  const dayStart = startOfDayCuiaba(now);
  const weekStart = startOfWeekCuiaba(now);
  const monthStart = startOfMonthCuiaba(now);
  const nowMs = now.getTime();

  let hoje = 0, semana = 0, mes = 0;
  for (const p of posts) {
    const t = new Date(p.timestamp).getTime();
    if (Number.isNaN(t)) continue;
    if (t > nowMs) continue; // ignora futuro
    if (t >= dayStart.getTime()) hoje++;
    if (t >= weekStart.getTime()) semana++;
    if (t >= monthStart.getTime()) mes++;
  }
  return { hoje, semana, mes };
}

// Re-exporta pra debug/uso externo se precisar
export { startOfDayCuiaba, startOfWeekCuiaba, startOfMonthCuiaba, APP_TIMEZONE };
