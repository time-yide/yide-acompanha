// src/lib/calendario/recurrence.ts
export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";
export type RecurrenceEndKind = "date" | "count" | "forever";

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number; // >= 1
  byweekday?: number[]; // 0=seg .. 6=dom (só usado quando freq = weekly)
  endKind: RecurrenceEndKind;
  until?: string; // "YYYY-MM-DD" quando endKind = "date"
  count?: number; // quando endKind = "count"
}

export interface Occurrence {
  inicio: string; // "YYYY-MM-DDTHH:mm"
  fim: string;
}

/** Horizonte gerado para séries "forever" (e re-estendido pelo cron). */
export const FOREVER_HORIZON_MONTHS = 12;
/** Teto de segurança pra nunca gerar linhas demais de uma vez. */
export const MAX_OCCURRENCES = 750;
const MAX_ITER = 20000;

function parseNaive(s: string): Date {
  const [datePart, timePart = "00:00"] = s.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi ?? 0, 0, 0));
}

function formatNaive(dt: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}T${p(dt.getUTCHours())}:${p(dt.getUTCMinutes())}`;
}

function daysInMonthUTC(year: number, monthZeroBased: number): number {
  return new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
}

export function addMonthsUTC(base: Date, months: number): Date {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * Expande uma regra de recorrência em ocorrências concretas.
 * Opera em strings locais ingênuas ("YYYY-MM-DDTHH:mm"): a aritmética usa
 * getters/setters UTC só pra não sofrer com o fuso do host, e reserializa
 * mantendo o mesmo formato ingênuo que é gravado no banco.
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  firstInicio: string,
  firstFim: string,
  horizonEnd: Date,
): Occurrence[] {
  const startDt = parseNaive(firstInicio);
  const durationMs = parseNaive(firstFim).getTime() - startDt.getTime();
  const interval = Math.max(1, Math.floor(rule.interval || 1));

  const untilTime = rule.endKind === "date" && rule.until ? parseNaive(`${rule.until}T23:59`).getTime() : null;
  const limitTime = rule.endKind === "forever" ? horizonEnd.getTime() : null;
  const maxCount = rule.endKind === "count" ? Math.max(1, Math.floor(rule.count ?? 1)) : null;

  const out: Occurrence[] = [];

  // Retorna false quando o chamador deve PARAR o loop.
  const push = (dt: Date): boolean => {
    if (untilTime !== null && dt.getTime() > untilTime) return false;
    if (limitTime !== null && dt.getTime() > limitTime) return false;
    out.push({ inicio: formatNaive(dt), fim: formatNaive(new Date(dt.getTime() + durationMs)) });
    if (maxCount !== null && out.length >= maxCount) return false;
    if (out.length >= MAX_OCCURRENCES) return false;
    return true;
  };

  if (rule.freq === "daily") {
    for (let k = 0; k < MAX_ITER; k++) {
      const dt = new Date(startDt);
      dt.setUTCDate(startDt.getUTCDate() + k * interval);
      if (!push(dt)) break;
    }
    return out;
  }

  if (rule.freq === "weekly") {
    const weekdayOfStart = (startDt.getUTCDay() + 6) % 7;
    const days = (rule.byweekday && rule.byweekday.length ? [...new Set(rule.byweekday)] : [weekdayOfStart]).sort((a, b) => a - b);
    const monday = new Date(startDt);
    monday.setUTCDate(startDt.getUTCDate() - weekdayOfStart);
    let stop = false;
    for (let w = 0; !stop && w < MAX_ITER; w += interval) {
      for (const wd of days) {
        const dt = new Date(monday);
        dt.setUTCDate(monday.getUTCDate() + w * 7 + wd);
        if (dt.getTime() < startDt.getTime()) continue; // pula dias antes do início na 1ª semana
        if (!push(dt)) { stop = true; break; }
      }
    }
    return out;
  }

  // monthly / yearly: incrementa mês/ano; pula datas inexistentes (31, 29-fev).
  const day = startDt.getUTCDate();
  const monthStep = rule.freq === "monthly" ? interval : interval * 12;
  for (let k = 0; k < MAX_ITER; k++) {
    const base = new Date(Date.UTC(startDt.getUTCFullYear(), startDt.getUTCMonth() + k * monthStep, 1, startDt.getUTCHours(), startDt.getUTCMinutes(), 0, 0));
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth();
    if (day > daysInMonthUTC(y, m)) {
      // Mês/ano sem esse dia (ex: 31 em fev, 29-fev não-bissexto). Pula,
      // mas confere o horizonte pra não girar pra sempre.
      const monthStartTime = Date.UTC(y, m, 1);
      if (untilTime !== null && monthStartTime > untilTime) break;
      if (limitTime !== null && monthStartTime > limitTime) break;
      continue;
    }
    const dt = new Date(base);
    dt.setUTCDate(day);
    if (!push(dt)) break;
  }
  return out;
}

/** Lê os campos de recorrência do FormData. Retorna null se freq = none. */
export function parseRecurrenceFromForm(formData: FormData): RecurrenceRule | null {
  const freq = String(formData.get("recurrence_freq") ?? "none");
  if (freq === "none" || !["daily", "weekly", "monthly", "yearly"].includes(freq)) return null;

  const interval = Math.max(1, parseInt(String(formData.get("recurrence_interval") ?? "1"), 10) || 1);
  const byweekday = (formData.getAll("recurrence_byweekday") as string[])
    .map((v) => parseInt(v, 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  const endKindRaw = String(formData.get("recurrence_end_kind") ?? "forever");
  const endKind: RecurrenceEndKind = ["date", "count", "forever"].includes(endKindRaw)
    ? (endKindRaw as RecurrenceEndKind)
    : "forever";

  const rule: RecurrenceRule = { freq: freq as RecurrenceFreq, interval, endKind };
  if (freq === "weekly" && byweekday.length) rule.byweekday = byweekday.sort((a, b) => a - b);
  if (endKind === "date") rule.until = String(formData.get("recurrence_until") ?? "") || undefined;
  if (endKind === "count") rule.count = Math.max(1, parseInt(String(formData.get("recurrence_count") ?? "1"), 10) || 1);
  return rule;
}
