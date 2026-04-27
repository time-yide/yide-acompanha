import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent, SubCalendar } from "./schema";

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
  const d = new Date(reference);
  d.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayOfWeek);
  const start = new Date(d);
  const end = new Date(d);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export async function listEventsForWeek(weekStart: Date, weekEnd: Date): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const events: CalendarEvent[] = [];

  // 1) Manual events
  const { data: manual = [] } = await supabase
    .from("calendar_events")
    .select(`id, titulo, descricao, inicio, fim, sub_calendar, client_id, lead_id`)
    .gte("inicio", weekStart.toISOString())
    .lt("inicio", weekEnd.toISOString());

  for (const m of manual ?? []) {
    events.push({
      id: m.id,
      origem: "manual",
      titulo: m.titulo,
      descricao: m.descricao,
      inicio: m.inicio,
      fim: m.fim,
      sub_calendar: m.sub_calendar as SubCalendar,
      link: `/calendario/${m.id}`,
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
