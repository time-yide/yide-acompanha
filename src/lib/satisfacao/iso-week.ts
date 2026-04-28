/**
 * Helpers de semana ISO 8601.
 * Formato: 'YYYY-Www' (ex: '2026-W17').
 * ISO 8601 define semana 01 como aquela que contém a primeira quinta-feira do ano.
 */

export function isoWeek(date: Date = new Date()): string {
  // Cópia em UTC pra evitar pulos de fuso horário
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Domingo=0, Segunda=1, ..., Sábado=6 (UTC). ISO usa segunda como início da semana.
  const dayNum = (target.getUTCDay() + 6) % 7; // segunda=0 ... domingo=6
  // Ir pra quinta-feira da semana atual
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const yearOfThursday = target.getUTCFullYear();
  // Primeira quinta-feira do ano
  const firstThursday = new Date(Date.UTC(yearOfThursday, 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);
  // Diferença em semanas
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${yearOfThursday}-W${String(week).padStart(2, "0")}`;
}

export function currentIsoWeek(): string {
  return isoWeek(new Date());
}

export function previousIsoWeek(weekIso: string): string {
  // Pega data de uma quinta-feira da semana referenciada e subtrai 7 dias
  const match = weekIso.match(/^(\d{4})-W(\d{2})$/);
  if (!match) throw new Error(`Invalid ISO week format: ${weekIso}`);
  const [, yearStr, weekStr] = match;
  const year = Number(yearStr);
  const week = Number(weekStr);
  // Quinta da primeira semana ISO do ano = 4-jan ajustado
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  // Quinta da semana 1
  const thursdayWeek1 = new Date(jan4);
  thursdayWeek1.setUTCDate(jan4.getUTCDate() - jan4DayNum + 3);
  // Quinta da semana especificada
  const thursdayWeekN = new Date(thursdayWeek1);
  thursdayWeekN.setUTCDate(thursdayWeek1.getUTCDate() + (week - 1) * 7);
  // Subtrai 7 dias e calcula isoWeek dessa data
  thursdayWeekN.setUTCDate(thursdayWeekN.getUTCDate() - 7);
  return isoWeek(thursdayWeekN);
}
