import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { CalendarEvent, SubCalendar } from "./schema";
import { getAppTimezoneOffsetMs, getDatePartsInAppTz } from "@/lib/datetime/timezone";

const HOUR = 60 * 60 * 1000;

export function computeBirthdayThisYear(birthDateISO: string, today: Date = new Date()): Date {
  const [year, month, day] = birthDateISO.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Data inválida");

  const thisYear = new Date(Date.UTC(today.getUTCFullYear(), month - 1, day, 12, 0, 0));
  if (thisYear.getTime() < today.getTime() - 24 * HOUR) {
    return new Date(Date.UTC(today.getUTCFullYear() + 1, month - 1, day, 12, 0, 0));
  }
  return thisYear;
}

export function eventOverlapsWeek(
  inicioISO: string, fimISO: string, weekStart: Date, weekEnd: Date,
): boolean {
  const start = new Date(inicioISO).getTime();
  const end = new Date(fimISO).getTime();
  return start < weekEnd.getTime() && end > weekStart.getTime();
}

export interface WeekRange {
  start: Date;
  end: Date;
}

export function getWeekRange(reference: Date = new Date()): WeekRange {
  // Trabalha no fuso da app (Cuiabá UTC-4): semana é Segunda 00:00 → próxima
  // Segunda 00:00. Retorno é em UTC pra usar como bound do query Postgres.
  const parts = getDatePartsInAppTz(reference);
  const y = parseInt(parts.year, 10);
  const m = parseInt(parts.month, 10);
  const d = parseInt(parts.day, 10);
  const dayOfWeek = parts.weekday; // 0=Dom, 1=Seg, ..., 6=Sab
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const offsetMs = getAppTimezoneOffsetMs(reference);

  // Segunda 00:00 no fuso da app → UTC
  const startUtcMs = Date.UTC(y, m - 1, d - daysSinceMonday, 0, 0, 0, 0) + offsetMs;
  const endUtcMs = startUtcMs + 7 * 24 * 60 * 60 * 1000;

  return { start: new Date(startUtcMs), end: new Date(endUtcMs) };
}

export interface MonthGridRange {
  /** Início da grade (Segunda ≤ dia 1 do mês), em UTC. */
  start: Date;
  /** Fim da grade (Segunda 6 semanas depois do início), em UTC. */
  end: Date;
  /** Ano/mês de referência (1-12) no fuso da app — pra colorir células in/out. */
  year: number;
  month: number;
}

/**
 * Calcula o range de 6 semanas (42 dias) que cobrem o mês de `reference`,
 * começando na Segunda anterior (ou igual) ao dia 1. Estilo Google Calendar
 * mas com semana iniciando na Segunda (consistente com o WeekView da app).
 */
export function getMonthGridRange(reference: Date = new Date()): MonthGridRange {
  const parts = getDatePartsInAppTz(reference);
  const y = parseInt(parts.year, 10);
  const m = parseInt(parts.month, 10);

  const offsetMs = getAppTimezoneOffsetMs(reference);

  // Weekday do dia 1 do mês no fuso da app
  const firstOfMonthUtcMs = Date.UTC(y, m - 1, 1, 0, 0, 0, 0) + offsetMs;
  const firstWeekday = getDatePartsInAppTz(new Date(firstOfMonthUtcMs)).weekday;
  const daysBeforeMonday = (firstWeekday + 6) % 7;

  const startUtcMs = Date.UTC(y, m - 1, 1 - daysBeforeMonday, 0, 0, 0, 0) + offsetMs;
  const endUtcMs = startUtcMs + 42 * 24 * 60 * 60 * 1000;

  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs),
    year: y,
    month: m,
  };
}

/**
 * Implementação interna que faz as 5 queries pesadas. Usa service-role pra
 * funcionar dentro de unstable_cache (não há request context). RLS é
 * permissiva pra todos esses recursos (`using (true)` em authenticated),
 * então o resultado é idêntico ao cookie-based.
 */
async function _listEventsForWeekImpl(weekStartIso: string, weekEndIso: string): Promise<CalendarEvent[]> {
  const weekStart = new Date(weekStartIso);
  const weekEnd = new Date(weekEndIso);
  const supabase = createServiceRoleClient();
  const events: CalendarEvent[] = [];

  // 1) Manual events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;
  const fullSelect = `id, titulo, descricao, inicio, fim, sub_calendar, client_id, lead_id, criado_por, participantes_ids, localizacao_endereco, localizacao_maps_url, link_roteiro, observacoes_gravacao, videomaker_status, videomaker_assigned_id`;
  const legacySelect = `id, titulo, descricao, inicio, fim, sub_calendar, client_id, lead_id, criado_por, participantes_ids, localizacao_endereco, localizacao_maps_url, link_roteiro, observacoes_gravacao`;

  let manualResult = await supabaseAny
    .from("calendar_events")
    .select(fullSelect)
    .gte("inicio", weekStart.toISOString())
    .lt("inicio", weekEnd.toISOString());

  // Fallback: se a migration 20260603000000 (videomaker_status etc) ainda não
  // foi aplicada nesse ambiente, o select dispara erro de coluna inexistente.
  // Re-tenta sem as colunas novas pra não esvaziar o calendário inteiro.
  if (manualResult.error) {
    const msg = String(manualResult.error.message ?? "");
    if (msg.includes("videomaker_status") || msg.includes("videomaker_assigned_id") || msg.includes("schema cache")) {
      console.warn("[calendario] fallback pro select legacy (migration 20260603000000 não aplicada):", msg);
      manualResult = await supabaseAny
        .from("calendar_events")
        .select(legacySelect)
        .gte("inicio", weekStart.toISOString())
        .lt("inicio", weekEnd.toISOString());
    } else {
      console.error("[calendario] manual events fetch failed:", manualResult.error);
    }
  }

  const manual = manualResult.data ?? [];
  for (const m of manual) {
    events.push({
      id: m.id,
      origem: "manual",
      titulo: m.titulo,
      descricao: m.descricao,
      inicio: m.inicio,
      fim: m.fim,
      sub_calendar: m.sub_calendar as SubCalendar,
      link: `/calendario/${m.id}`,
      criado_por: m.criado_por,
      participantes_ids: (m.participantes_ids ?? []) as string[],
      localizacao_endereco: m.localizacao_endereco,
      localizacao_maps_url: m.localizacao_maps_url,
      link_roteiro: m.link_roteiro,
      observacoes_gravacao: m.observacoes_gravacao,
      videomaker_status: m.videomaker_status ?? null,
      videomaker_assigned_id: m.videomaker_assigned_id ?? null,
    });
  }

  // 2) Leads
  const { data: leads = [] } = await supabase
    .from("leads")
    .select("id, nome_prospect, data_prospeccao_agendada, data_reuniao_marco_zero, stage")
    .or(
      `data_prospeccao_agendada.gte.${weekStart.toISOString()},data_reuniao_marco_zero.gte.${weekStart.toISOString()}`
    );

  for (const l of leads ?? []) {
    if (l.data_prospeccao_agendada) {
      const start = new Date(l.data_prospeccao_agendada);
      const end = new Date(start.getTime() + HOUR);
      if (eventOverlapsWeek(start.toISOString(), end.toISOString(), weekStart, weekEnd)) {
        events.push({
          id: `lead-prosp-${l.id}`,
          origem: "lead_prospeccao",
          titulo: `Prospecção: ${l.nome_prospect}`,
          descricao: null,
          inicio: start.toISOString(),
          fim: end.toISOString(),
          sub_calendar: "onboarding",
          link: `/onboarding/${l.id}`,
        });
      }
    }
    if (l.data_reuniao_marco_zero && l.stage !== "ativo") {
      const start = new Date(l.data_reuniao_marco_zero);
      const end = new Date(start.getTime() + HOUR);
      if (eventOverlapsWeek(start.toISOString(), end.toISOString(), weekStart, weekEnd)) {
        events.push({
          id: `lead-mz-${l.id}`,
          origem: "lead_marco_zero",
          titulo: `Marco Zero: ${l.nome_prospect}`,
          descricao: null,
          inicio: start.toISOString(),
          fim: end.toISOString(),
          sub_calendar: "onboarding",
          link: `/onboarding/${l.id}`,
        });
      }
    }
  }

  // 3) Client birthdays
  const { data: clientsBirthdays = [] } = await supabase
    .from("clients")
    .select("id, nome, data_aniversario_socio_cliente")
    .eq("status", "ativo")
    .not("data_aniversario_socio_cliente", "is", null);

  for (const c of clientsBirthdays ?? []) {
    if (!c.data_aniversario_socio_cliente) continue;
    const next = computeBirthdayThisYear(c.data_aniversario_socio_cliente, weekStart);
    const fim = new Date(next.getTime() + HOUR);
    if (eventOverlapsWeek(next.toISOString(), fim.toISOString(), weekStart, weekEnd)) {
      events.push({
        id: `client-bd-${c.id}-${next.getUTCFullYear()}`,
        origem: "client_birthday",
        titulo: `Aniversário sócio: ${c.nome}`,
        descricao: null,
        inicio: next.toISOString(),
        fim: fim.toISOString(),
        sub_calendar: "aniversarios",
        link: `/clientes/${c.id}`,
      });
    }
  }

  // 4) Collaborator birthdays
  const { data: colabsBirthdays = [] } = await supabase
    .from("profiles")
    .select("id, nome, data_nascimento")
    .eq("ativo", true)
    .not("data_nascimento", "is", null);

  for (const p of colabsBirthdays ?? []) {
    if (!p.data_nascimento) continue;
    const next = computeBirthdayThisYear(p.data_nascimento, weekStart);
    const fim = new Date(next.getTime() + HOUR);
    if (eventOverlapsWeek(next.toISOString(), fim.toISOString(), weekStart, weekEnd)) {
      events.push({
        id: `colab-bd-${p.id}-${next.getUTCFullYear()}`,
        origem: "colab_birthday",
        titulo: `Aniversário: ${p.nome}`,
        descricao: null,
        inicio: next.toISOString(),
        fim: fim.toISOString(),
        sub_calendar: "aniversarios",
        link: `/colaboradores/${p.id}`,
      });
    }
  }

  // 5) Client important dates
  const { data: clientDates = [] } = await supabase
    .from("client_important_dates")
    .select(`
      id, data, descricao, tipo, client_id,
      cliente:clients(id, nome)
    `)
    .gte("data", weekStart.toISOString().slice(0, 10))
    .lt("data", weekEnd.toISOString().slice(0, 10));

  for (const d of clientDates ?? []) {
    const start = new Date(`${d.data}T12:00:00Z`);
    const fim = new Date(start.getTime() + HOUR);
    const clientName = (d.cliente as unknown as { nome?: string } | null)?.nome ?? "cliente";
    events.push({
      id: `client-date-${d.id}`,
      origem: "client_date",
      titulo: `${d.descricao} (${clientName})`,
      descricao: null,
      inicio: start.toISOString(),
      fim: fim.toISOString(),
      sub_calendar: d.tipo === "aniversario_socio" ? "aniversarios" : "agencia",
      link: `/clientes/${d.client_id}`,
    });
  }

  events.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return events;
}

/**
 * Versão cacheada (60s) com tag "calendar". Mutations no calendário
 * (createEventAction, updateEventAction, deleteEventAction) chamam
 * revalidateTag("calendar") pra invalidar imediatamente.
 */
export async function listEventsForWeek(weekStart: Date, weekEnd: Date): Promise<CalendarEvent[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { from, to } = JSON.parse(paramsJson) as { from: string; to: string };
      return _listEventsForWeekImpl(from, to);
    },
    // v2: shape ganhou videomaker_status + videomaker_assigned_id
    ["calendario-week-events-v2"],
    { revalidate: 60, tags: ["calendar"] },
  );
  return cached(JSON.stringify({ from: weekStart.toISOString(), to: weekEnd.toISOString() }));
}

export async function getEventById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select(`
      *,
      criador:profiles!calendar_events_criado_por_fkey(id, nome),
      cliente:clients(id, nome),
      lead:leads(id, nome_prospect)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}
