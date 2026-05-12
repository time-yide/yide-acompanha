// Helpers de timezone pro calendário.
//
// Convenção: o input `datetime-local` do form representa wall-clock no fuso
// da app (Cuiabá UTC-4, sem DST). Postgres armazena timestamptz em UTC.
// Esses helpers fazem a conversão explícita nos boundaries — input/output
// do banco — pra evitar que Postgres interprete strings sem TZ como UTC e
// gere desvio de 4h.
//
// Pra novo código, prefira importar diretamente de `@/lib/datetime/timezone`.
// Este arquivo mantém os nomes históricos (`formatBrtDateTime`,
// `formatBrtTime`, etc.) por compatibilidade — todos delegam pro módulo
// central com APP_TIMEZONE = "America/Cuiaba".

import {
  APP_TIMEZONE,
  formatDateBR as _formatDateBR,
  formatDateTimeBR as _formatDateTimeBR,
  formatIsoDate as _formatIsoDate,
  formatTimeBR as _formatTimeBR,
  getAppTimezoneOffsetMs,
  getDatePartsInAppTz,
} from "@/lib/datetime/timezone";

/**
 * Converte string de `<input type="datetime-local">` (wall-clock no fuso
 * da app) pra ISO UTC.
 *
 * Ex.: usuário digita "2026-05-12T14:00" em Cuiabá (UTC-4) → salvamos no
 * banco como "2026-05-12T18:00:00.000Z".
 */
export function brtInputToUtcIso(localStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(localStr)) {
    throw new Error(`Invalid datetime-local format: "${localStr}"`);
  }
  const withSeconds = localStr.length === 16 ? `${localStr}:00` : localStr;
  // Parseia componentes
  const [datePart, timePart] = withSeconds.split("T");
  const [yyyy, mm, dd] = datePart.split("-").map(Number);
  const [hh, mi, ss] = timePart.split(":").map(Number);

  // Offset positivo do fuso da app (Cuiabá = +4h em ms)
  const offsetMs = getAppTimezoneOffsetMs();
  // Wall-clock no fuso da app → UTC adiciona o offset
  const utcMs = Date.UTC(yyyy, mm - 1, dd, hh, mi, ss, 0) + offsetMs;
  return new Date(utcMs).toISOString();
}

/**
 * Converte ISO UTC (vindo do banco) pra valor compatível com
 * `<input type="datetime-local">` no wall-clock do fuso da app.
 *
 * Ex.: "2026-05-12T18:00:00.000Z" (UTC) → "2026-05-12T14:00" (Cuiabá).
 */
export function utcIsoToBrtInputValue(utcIso: string): string {
  const parts = getDatePartsInAppTz(new Date(utcIso));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * Formata ISO UTC como data+hora no fuso da app.
 * Ex.: "2026-05-12T18:00:00.000Z" → "12/05/2026 14:00".
 */
export function formatBrtDateTime(utcIso: string): string {
  return _formatDateTimeBR(utcIso);
}

/**
 * Formata ISO UTC como HH:mm no fuso da app.
 * Ex.: "2026-05-12T18:00:00.000Z" → "14:00".
 */
export function formatBrtTime(utcIso: string): string {
  return _formatTimeBR(utcIso);
}

/**
 * Formata só a data "DD/MM/YYYY" no fuso da app.
 */
export function formatBrtDate(utcIso: string): string {
  return _formatDateBR(utcIso);
}

/**
 * Retorna dia da semana (0=Dom..6=Sab) no fuso da app.
 * Importante pra agrupar eventos em WeekView sem que eventos do tipo
 * "Domingo 23:30 Cuiabá" (que viram Segunda em UTC) apareçam na coluna errada.
 */
export function getBrtDayOfWeek(utcIso: string): number {
  return getDatePartsInAppTz(new Date(utcIso)).weekday;
}

/**
 * Extrai a data (YYYY-MM-DD) no fuso da app de um ISO UTC.
 * Substitui o ingênuo `.slice(0, 10)` que dá o dia em UTC.
 */
export function formatBrtDateOnly(utcIso: string): string {
  return _formatIsoDate(utcIso);
}

// Re-exporta o timezone central pra quem precisa
export { APP_TIMEZONE };
