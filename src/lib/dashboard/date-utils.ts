/**
 * Helpers puros de manipulação de mês 'YYYY-MM'.
 * Tudo em UTC para evitar surpresas de fuso.
 */

export function monthRange(count: number, from: Date = new Date()): string[] {
  const result: string[] = [];
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - i, 1));
    result.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

const MONTH_LABELS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function monthLabel(yyyymm: string): string {
  const [yearStr, monthStr] = yyyymm.split("-");
  const monthIndex = Number(monthStr) - 1;
  return `${MONTH_LABELS_PT[monthIndex]}/${yearStr}`;
}

export function lastDayOfMonth(yyyymm: string): string {
  const [yearStr, monthStr] = yyyymm.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12
  // dia 0 do próximo mês = último dia do mês corrente
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yyyymm}-${String(lastDay).padStart(2, "0")}`;
}

export function isInMonth(isoDate: string | null | undefined, yyyymm: string): boolean {
  if (!isoDate) return false;
  return isoDate.slice(0, 7) === yyyymm;
}

/** Últimos `count` meses 'YYYY-MM', do mais recente pro mais antigo. */
export function mesesRecentes(count: number, from: Date = new Date()): string[] {
  return monthRange(count, from).slice().reverse();
}

/** Mês anterior a um 'YYYY-MM'. */
export function previousMonthYM(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Valida `?mes=`: precisa estar nos últimos 12 meses (inclui atual), senão cai no atual. */
export function parseMes(raw: string | undefined, from: Date = new Date()): string {
  const validos = new Set(mesesRecentes(12, from));
  if (raw && /^\d{4}-\d{2}$/.test(raw) && validos.has(raw)) return raw;
  return mesesRecentes(1, from)[0];
}
