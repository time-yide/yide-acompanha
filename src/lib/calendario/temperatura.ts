import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getDatePartsInAppTz } from "@/lib/datetime/timezone";
import { getWeekRange } from "./queries";

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
  peak: number[][]; // 7 x 3  [dia][faixa] faixa: 0=manhã,1=tarde,2=noite
  totalThisWeek: number;
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

function hourBucket(iso: string): 0 | 1 | 2 {
  const h = parseInt(getDatePartsInAppTz(iso).hour, 10);
  if (h < 12) return 0;
  if (h < 18) return 1;
  return 2;
}

function involvedTeamMembers(e: TempEvent, teamSet: Set<string>): string[] {
  const ids = new Set<string>();
  if (e.criado_por && teamSet.has(e.criado_por)) ids.add(e.criado_por);
  for (const p of e.participantes_ids ?? []) if (teamSet.has(p)) ids.add(p);
  return [...ids];
}

/** Agrega os eventos de UMA semana nas 4 métricas, restrito ao time. */
export function aggregateTemperatura(events: TempEvent[], teamMemberIds: string[]): Temperatura {
  const teamSet = new Set(teamMemberIds);
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  const peak: number[][] = Array.from({ length: 7 }, () => [0, 0, 0]);
  const personMap = new Map<string, PersonLoad>();
  let total = 0;

  for (const e of events) {
    const members = involvedTeamMembers(e, teamSet);
    if (members.length === 0) continue; // evento sem ninguém do time não conta

    const wd = weekdayMondayZero(e.inicio);
    byWeekday[wd] += 1;
    peak[wd][hourBucket(e.inicio)] += 1;
    total += 1;

    const minutes = Math.max(0, Math.round((new Date(e.fim).getTime() - new Date(e.inicio).getTime()) / 60000));
    for (const m of members) {
      const cur = personMap.get(m) ?? { userId: m, count: 0, minutes: 0 };
      cur.count += 1;
      cur.minutes += minutes;
      personMap.set(m, cur);
    }
  }

  const byPerson = [...personMap.values()].sort((a, b) => b.count - a.count || b.minutes - a.minutes);
  return { byWeekday, byPerson, peak, totalThisWeek: total };
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
  return [...new Set([coordinatorId, ...ids.filter(Boolean)])];
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
  week: { start: string; end: string };
  temperatura: Temperatura;
  trend: Trend;
  teamMemberIds: string[];
}

async function _getTemperaturaImpl(coordinatorId: string, weekRefIso: string): Promise<TemperaturaResult> {
  const teamMemberIds = await fetchTeamMemberIds(coordinatorId);
  const { start, end } = getWeekRange(new Date(weekRefIso));

  const events = await fetchTeamEventsInRange(start, end);
  const temperatura = aggregateTemperatura(events, teamMemberIds);

  // 4 semanas anteriores para a tendência.
  const previousTotals: number[] = [];
  for (let i = 1; i <= 4; i++) {
    const s = new Date(start);
    s.setUTCDate(s.getUTCDate() - 7 * i);
    const e = new Date(end);
    e.setUTCDate(e.getUTCDate() - 7 * i);
    const evs = await fetchTeamEventsInRange(s, e);
    previousTotals.push(aggregateTemperatura(evs, teamMemberIds).totalThisWeek);
  }

  const trend = computeTrend(temperatura.totalThisWeek, previousTotals);
  return { week: { start: start.toISOString(), end: end.toISOString() }, temperatura, trend, teamMemberIds };
}

/**
 * Versão cacheada por (coordenador + semana). Service-role only (roda dentro
 * de unstable_cache, sem request context). Tag "calendar" — invalida junto
 * com as mutations de evento.
 */
export async function getTemperaturaForCoordinator(coordinatorId: string, weekRef: Date): Promise<TemperaturaResult> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { coord, week } = JSON.parse(paramsJson) as { coord: string; week: string };
      return _getTemperaturaImpl(coord, week);
    },
    ["calendario-temperatura-v1"],
    { revalidate: 300, tags: ["calendar"] },
  );
  return cached(JSON.stringify({ coord: coordinatorId, week: weekRef.toISOString() }));
}
