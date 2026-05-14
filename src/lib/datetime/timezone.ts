// Timezone canônico da aplicação.
//
// Decisão de produto: TODOS os colaboradores enxergam datas/horas no fuso
// de Cuiabá (Mato Grosso, Brasil) — `America/Cuiaba`. Independente de onde
// o colaborador esteja viajando. Independente do servidor (Vercel = UTC).
//
// Cuiabá é UTC-4 sempre (Mato Grosso não tem horário de verão). Brasília
// é UTC-3. Diferença de 1 hora.
//
// IMPORTANTE: NUNCA use `new Date().toLocaleString(...)` sem passar
// `timeZone: APP_TIMEZONE`. NUNCA use offsets hardcoded como
// `3 * 60 * 60 * 1000`. Sempre use os helpers deste arquivo.

/** Timezone canônico da app — `America/Cuiaba` (UTC-4 sempre). */
export const APP_TIMEZONE = "America/Cuiaba" as const;

/** Locale padrão pra formatação. */
export const APP_LOCALE = "pt-BR" as const;

// ─── Helpers de formatação (Intl-based — robusto, lida com DST) ────────────

/**
 * Formata como "DD/MM/YYYY" no fuso da app.
 * Aceita Date, ISO string, ou timestamp number.
 */
export function formatDateBR(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined) return "";
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Formata como "DD/MM/YYYY HH:mm" no fuso da app.
 */
export function formatDateTimeBR(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined) return "";
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Formata só hora "HH:mm" no fuso da app. */
export function formatTimeBR(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined) return "";
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Formata como "DD de MMMM de YYYY" (formato longo, com nome do mês por extenso).
 */
export function formatLongDateBR(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined) return "";
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Formata como "DD/MM HH:mm" (compacto, sem ano — útil pra cards e listas).
 */
export function formatShortDateTimeBR(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined) return "";
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// ─── Helpers de cálculo ────────────────────────────────────────────────────

/**
 * Retorna o "dia de hoje" como string YYYY-MM-DD calculado no fuso da app.
 * Útil pra comparar com colunas `date` do Postgres.
 *
 * Ex.: se agora é 2026-05-13 00:30 UTC (UTC-4 Cuiabá = 20:30 do dia 12),
 * retorna "2026-05-12" (não "2026-05-13" que seria o dia UTC).
 */
export function getTodayDate(reference: Date = new Date()): string {
  return formatIsoDate(reference);
}

/**
 * Retorna mês/ano corrente no fuso da app no formato "YYYY-MM".
 * Útil pra colunas `mes_referencia` em snapshots/comissões.
 */
export function getCurrentMonthYM(reference: Date = new Date()): string {
  const parts = getDatePartsInAppTz(reference);
  return `${parts.year}-${parts.month}`;
}

/** Versão do `getCurrentMonthYM` pro mês anterior. */
export function getPreviousMonthYM(reference: Date = new Date()): string {
  const parts = getDatePartsInAppTz(reference);
  const y = parseInt(parts.year, 10);
  const m = parseInt(parts.month, 10);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Formata uma Date como "YYYY-MM-DD" no fuso da app.
 * Substituto seguro de `date.toISOString().slice(0, 10)` que dá UTC.
 */
export function formatIsoDate(date: Date | string | number): string {
  const d = toDate(date);
  const parts = getDatePartsInAppTz(d);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Retorna componentes de data (year/month/day/hour/minute) no fuso da app.
 * Usa Intl.DateTimeFormat com "en-CA" pra garantir formato ISO-like.
 */
export function getDatePartsInAppTz(date: Date | string | number = new Date()): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  /** Day of week (0=Sun..6=Sat) calculado no fuso. */
  weekday: number;
} {
  const d = toDate(date);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayStr = get("weekday");
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  // Algumas runtimes retornam "24" pra meia-noite — normalizar pra "00".
  const hourRaw = get("hour");
  const hour = hourRaw === "24" ? "00" : hourRaw;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
    weekday: weekdayMap[weekdayStr] ?? 0,
  };
}

/**
 * Início do dia (00:00) e fim (23:59:59) no fuso da app, retornados como
 * ISO UTC pra usar em queries Supabase (`gte` / `lte`).
 *
 * @param dateOrIsoDate Pode ser Date ou string "YYYY-MM-DD"
 */
export function getDayBoundariesIso(dateOrIsoDate: Date | string): { fromIso: string; toIso: string } {
  let year: number;
  let month: number;
  let day: number;

  if (typeof dateOrIsoDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateOrIsoDate)) {
    [year, month, day] = dateOrIsoDate.split("-").map(Number);
  } else {
    const parts = getDatePartsInAppTz(typeof dateOrIsoDate === "string" ? new Date(dateOrIsoDate) : dateOrIsoDate);
    year = parseInt(parts.year, 10);
    month = parseInt(parts.month, 10);
    day = parseInt(parts.day, 10);
  }

  // "YYYY-MM-DD 00:00 em America/Cuiaba" → ISO UTC
  // Cuiabá = UTC-4 (sem DST). 00:00 BRT-4 = 04:00 UTC.
  const offsetMs = getAppTimezoneOffsetMs(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
  const fromUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) + offsetMs;
  const toUtcMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999) + offsetMs;
  return {
    fromIso: new Date(fromUtcMs).toISOString(),
    toIso: new Date(toUtcMs).toISOString(),
  };
}

/**
 * Calcula offset atual do fuso da app em milissegundos.
 *
 * Pra Cuiabá (sem DST): sempre +4h = 14400000.
 * Cálculo dinâmico via Intl permite trocar APP_TIMEZONE no futuro sem
 * quebrar (ex.: se migrar pra America/Sao_Paulo que tem DST histórico).
 *
 * Retorna POSITIVO (UTC-4 = 4h = 14400000), porque usamos como
 * `utcMs + offsetMs` pra obter o "wall clock" no fuso da app, e
 * `wallClockMs - offsetMs` pra voltar pra UTC.
 */
export function getAppTimezoneOffsetMs(reference: Date = new Date()): number {
  const utcDate = new Date(reference.toLocaleString("en-US", { timeZone: "UTC" }));
  const appDate = new Date(reference.toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
  return utcDate.getTime() - appDate.getTime();
}

/**
 * Retorna "agora" como uma Date cuja representação UTC é equivalente ao
 * wall-clock atual no fuso da app. Útil pra construir ranges em horários
 * locais.
 *
 * Ex.: se agora é 03:00 UTC (= 23:00 Cuiabá no dia anterior), retorna uma
 * Date que ao chamar `.getUTCDate()` dá o dia 22 (dia local em Cuiabá).
 *
 * Use SÓ pra cálculos auxiliares — pra exibição use os formatters acima.
 */
export function nowInAppTz(): Date {
  const offset = getAppTimezoneOffsetMs();
  return new Date(Date.now() - offset);
}

// ─── Interno ───────────────────────────────────────────────────────────────

function toDate(input: Date | string | number): Date {
  if (input instanceof Date) return input;
  return new Date(input);
}
