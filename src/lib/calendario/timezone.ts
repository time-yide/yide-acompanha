// Helpers de timezone pro calendário.
//
// Convenção: o input `datetime-local` do form representa wall-clock BRT
// (horário de Brasília, UTC-3, sem DST desde 2019). Postgres armazena
// timestamptz em UTC. Esses helpers fazem a conversão explícita nos
// boundaries — input/output do banco — pra evitar que Postgres interprete
// strings sem TZ como UTC e gere desvio de 3h.

const BRT_OFFSET = "-03:00";
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Converte string de `<input type="datetime-local">` (wall-clock BRT) pra
 * ISO UTC. Exemplo: "2026-05-12T14:00" → "2026-05-12T17:00:00.000Z".
 *
 * Aceita formato "YYYY-MM-DDTHH:mm" ou "YYYY-MM-DDTHH:mm:ss".
 */
export function brtInputToUtcIso(localStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(localStr)) {
    throw new Error(`Invalid datetime-local format: "${localStr}"`);
  }
  const withSeconds = localStr.length === 16 ? `${localStr}:00` : localStr;
  return new Date(`${withSeconds}${BRT_OFFSET}`).toISOString();
}

/**
 * Converte ISO UTC (vindo do banco) pra valor BRT compatível com
 * `<input type="datetime-local">`. Exemplo: "2026-05-12T17:00:00.000Z" →
 * "2026-05-12T14:00".
 */
export function utcIsoToBrtInputValue(utcIso: string): string {
  const d = new Date(utcIso);
  const brtMs = d.getTime() - BRT_OFFSET_MS;
  return new Date(brtMs).toISOString().slice(0, 16);
}

/**
 * Formata ISO UTC como data+hora em pt-BR no timezone BRT.
 * Exemplo: "2026-05-12T17:00:00.000Z" → "12/05/2026 14:00".
 */
export function formatBrtDateTime(utcIso: string): string {
  return new Date(utcIso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formata ISO UTC como HH:mm no timezone BRT.
 * Exemplo: "2026-05-12T17:00:00.000Z" → "14:00".
 */
export function formatBrtTime(utcIso: string): string {
  return new Date(utcIso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Retorna o dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
 * usando o timezone BRT. Importante pra agrupar eventos em WeekView sem
 * que eventos do tipo "Domingo 23:30 BRT" (que viram Segunda em UTC)
 * apareçam na coluna errada.
 */
export function getBrtDayOfWeek(utcIso: string): number {
  const d = new Date(utcIso);
  const brtMs = d.getTime() - BRT_OFFSET_MS;
  return new Date(brtMs).getUTCDay();
}
