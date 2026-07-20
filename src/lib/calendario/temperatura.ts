import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAppTimezoneOffsetMs, getDatePartsInAppTz } from "@/lib/datetime/timezone";
import { getWeekRange } from "./queries";

export type TempPeriod = "week" | "month" | "quarter";

export interface TempEvent {
  inicio: string;
  fim: string;
  criado_por?: string | null;
  participantes_ids?: string[] | null;
}

export interface PersonLoad {
  userId: string;
  count: number;
  minutes: number;
}

export interface Temperatura {
  byWeekday: number[]; // length 7, 0=seg..6=dom
  byPerson: PersonLoad[]; // ordenado por count desc, depois minutes desc
  peakByHour: number[][]; // 7 x 24  [dia][hora] hora: 0..23
  total: number;
}

export interface Trend {
  current: number;
  avgPrevious: number;
  direction: "up" | "down" | "flat";
  deltaPct: number;
}

// Os eventos são gravados em UTC representando o horário local do app (Cuiabá,
// UTC-4). Um evento às 20:00 de Cuiabá está gravado como 00:00 UTC do dia
// seguinte. Por isso dia-da-semana e hora precisam ser lidos NO FUSO DO APP,
// não em UTC cru — senão os buckets vazam pro dia/faixa errado nas bordas.

function weekdayMondayZero(iso: string): number {
  // getDatePartsInAppTz.weekday: 0=Dom..6=Sab → converte pra 0=Seg..6=Dom.
  return (getDatePartsInAppTz(iso).weekday + 6) % 7;
}

/** Hora cheia (0..23) do evento, lida no fuso da app (Cuiabá UTC-4). */
export function hourOf(iso: string): number {
  return parseInt(getDatePartsInAppTz(iso).hour, 10);
}

export interface PeriodRange {
  start: Date;
  end: Date;
}

/**
 * Range de um período (semana/mês/trimestre) calculado NO FUSO DA APP e
 * retornado em UTC (pra usar como bound do query Postgres). Espelha o padrão
 * de `getWeekRange` — usa getDatePartsInAppTz + getAppTimezoneOffsetMs.
 */
export function getPeriodRange(period: TempPeriod, reference: Date = new Date()): PeriodRange {
  if (period === "week") return getWeekRange(reference);

  const parts = getDatePartsInAppTz(reference);
  const y = parseInt(parts.year, 10);
  const m = parseInt(parts.month, 10); // 1..12
  const offsetMs = getAppTimezoneOffsetMs(reference);

  if (period === "month") {
    // 1º dia do mês 00:00 (fuso app) → 1º dia do mês seguinte.
    const startUtcMs = Date.UTC(y, m - 1, 1, 0, 0, 0, 0) + offsetMs;
    const endUtcMs = Date.UTC(y, m, 1, 0, 0, 0, 0) + offsetMs;
    return { start: new Date(startUtcMs), end: new Date(endUtcMs) };
  }

  // quarter: mês inicial do trimestre e +3 meses.
  const startMonth = Math.floor((m - 1) / 3) * 3 + 1; // 1,4,7,10
  const startUtcMs = Date.UTC(y, startMonth - 1, 1, 0, 0, 0, 0) + offsetMs;
  const endUtcMs = Date.UTC(y, startMonth - 1 + 3, 1, 0, 0, 0, 0) + offsetMs;
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) };
}

function involvedTeamMembers(e: TempEvent, teamSet: Set<string>): string[] {
  const ids = new Set<string>();
  if (e.criado_por && teamSet.has(e.criado_por)) ids.add(e.criado_por);
  for (const p of e.participantes_ids ?? []) if (teamSet.has(p)) ids.add(p);
  return [...ids];
}

/** Agrega os eventos de UM período nas 4 métricas, restrito ao time. */
export function aggregateTemperatura(events: TempEvent[], teamMemberIds: string[]): Temperatura {
  const teamSet = new Set(teamMemberIds);
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  const peakByHour: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const personMap = new Map<string, PersonLoad>();
  let total = 0;

  for (const e of events) {
    const members = involvedTeamMembers(e, teamSet);
    if (members.length === 0) continue; // evento sem ninguém do time não conta

    const wd = weekdayMondayZero(e.inicio);
    byWeekday[wd] += 1;
    peakByHour[wd][hourOf(e.inicio)] += 1;
    total += 1;

    // Duração em minutos para a "carga". Eventos com mais de 24h são blocos
    // longos ou erros de data (ex.: fim com o ano errado) — não são carga de
    // trabalho pontual e distorceriam a soma (um único evento de ~10 anos com o
    // time todo inflaria a carga de todo mundo igual). Contam como evento, mas
    // com 0 min de carga.
    const durMs = new Date(e.fim).getTime() - new Date(e.inicio).getTime();
    const minutes = durMs > 0 && durMs <= 24 * 60 * 60 * 1000 ? Math.round(durMs / 60000) : 0;
    for (const m of members) {
      const cur = personMap.get(m) ?? { userId: m, count: 0, minutes: 0 };
      cur.count += 1;
      cur.minutes += minutes;
      personMap.set(m, cur);
    }
  }

  const byPerson = [...personMap.values()].sort((a, b) => b.count - a.count || b.minutes - a.minutes);
  return { byWeekday, byPerson, peakByHour, total };
}

/** Tendência: total atual vs. média das semanas anteriores. */
export function computeTrend(current: number, previousTotals: number[]): Trend {
  const avgPrevious = previousTotals.length
    ? previousTotals.reduce((s, n) => s + n, 0) / previousTotals.length
    : 0;
  // Sem semanas anteriores não há base de comparação → sem tendência ("flat").
  const direction: Trend["direction"] = !previousTotals.length
    ? "flat"
    : current > avgPrevious
      ? "up"
      : current < avgPrevious
        ? "down"
        : "flat";
  const deltaPct = avgPrevious === 0 ? 0 : Math.round(((current - avgPrevious) / avgPrevious) * 100);
  return { current, avgPrevious, direction, deltaPct };
}

// ---- Camada server ----

async function fetchTeamMemberIds(coordinatorId: string): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("recados_team_member_ids", { autor: coordinatorId });
  if (error || !data) return [];
  // A RPC retorna setof uuid → nos tipos gerados vem como uuid[]; defensivamente
  // trata também o formato de linhas ({ recados_team_member_ids: uuid }).
  const ids = (data as unknown as Array<string | { recados_team_member_ids: string }>).map((row) =>
    typeof row === "string" ? row : row.recados_team_member_ids,
  );
  // Inclui o próprio coordenador na visão do time.
  let teamIds = [...new Set([coordinatorId, ...ids.filter(Boolean)])];

  // Fast Mídia exerce função de videomaker e integra o time audiovisual,
  // mas não está no retorno da RPC compartilhada (recados_team_member_ids,
  // usada também pelos recados — NÃO alterar). Aumentamos o time só aqui.
  const { data: coordinator } = await supabase
    .from("profiles").select("role").eq("id", coordinatorId).maybeSingle();
  if (coordinator?.role === "audiovisual_chefe") {
    const { data: fastMidia } = await supabase
      .from("profiles").select("id").eq("ativo", true)
      .eq("role", "fast_midia" as never); // 'fast_midia' pode não estar no enum tipado
    const extra = (fastMidia ?? []).map((r) => r.id);
    teamIds = [...new Set([...teamIds, ...extra])];
  }

  return teamIds;
}

async function fetchTeamEventsInRange(start: Date, end: Date): Promise<TempEvent[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("inicio, fim, criado_por, participantes_ids")
    .gte("inicio", start.toISOString())
    .lt("inicio", end.toISOString());
  return (data ?? []) as TempEvent[];
}

export interface TemperaturaResult {
  range: { start: string; end: string };
  period: TempPeriod;
  temperatura: Temperatura;
  trend: Trend;
  teamMemberIds: string[];
}

async function _getTemperaturaImpl(
  coordinatorId: string,
  refIso: string,
  period: TempPeriod,
): Promise<TemperaturaResult> {
  const teamMemberIds = await fetchTeamMemberIds(coordinatorId);
  const range = getPeriodRange(period, new Date(refIso));

  const events = await fetchTeamEventsInRange(range.start, range.end);
  const temperatura = aggregateTemperatura(events, teamMemberIds);

  // 4 períodos anteriores para a tendência. Iteramos a partir do início do
  // período atual e voltamos um período por vez usando getPeriodRange no
  // instante imediatamente anterior ao início — assim funciona pra mês/
  // trimestre sem depender do tamanho fixo do período.
  const previousTotals: number[] = [];
  let cursorStart = range.start;
  for (let i = 1; i <= 4; i++) {
    const prevRef = new Date(cursorStart.getTime() - 1);
    const prev = getPeriodRange(period, prevRef);
    const evs = await fetchTeamEventsInRange(prev.start, prev.end);
    previousTotals.push(aggregateTemperatura(evs, teamMemberIds).total);
    cursorStart = prev.start;
  }

  const trend = computeTrend(temperatura.total, previousTotals);
  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    period,
    temperatura,
    trend,
    teamMemberIds,
  };
}

/**
 * Versão cacheada por (coordenador + referência + período). Service-role only
 * (roda dentro de unstable_cache, sem request context). Tag "calendar" —
 * invalida junto com as mutations de evento.
 */
export async function getTemperaturaForCoordinator(
  coordinatorId: string,
  ref: Date,
  period: TempPeriod,
): Promise<TemperaturaResult> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { coord, ref: refIso, period: p } = JSON.parse(paramsJson) as {
        coord: string;
        ref: string;
        period: TempPeriod;
      };
      return _getTemperaturaImpl(coord, refIso, p);
    },
    // v2: shape mudou (peakByHour 7x24, total, range/period) + suporte a período.
    ["calendario-temperatura-v3"],
    { revalidate: 300, tags: ["calendar"] },
  );
  return cached(JSON.stringify({ coord: coordinatorId, ref: ref.toISOString(), period }));
}
