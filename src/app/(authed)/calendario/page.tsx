import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import {
  listEventsForWeek,
  getWeekRange,
  getMonthGridRange,
} from "@/lib/calendario/queries";
import { SUB_CALENDARS } from "@/lib/calendario/schema";
import { WeekView } from "@/components/calendario/WeekView";
import { MonthView, formatMonthLabel } from "@/components/calendario/MonthView";
import { SubCalendarChips } from "@/components/calendario/SubCalendarChips";
import { ViewSwitch } from "@/components/calendario/ViewSwitch";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";
import type { CalendarEvent } from "@/lib/calendario/schema";

const VALID_SUBS: ReadonlySet<string> = new Set([...SUB_CALENDARS, "meus"]);

type View = "week" | "month";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    month?: string;
    sub?: string | string[];
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();

  const view: View = params.view === "month" ? "month" : "week";

  // Radio: um valor só. Aceita string ou string[] (compat com URLs antigas).
  const rawSub =
    typeof params.sub === "string"
      ? params.sub
      : Array.isArray(params.sub)
        ? params.sub[0]
        : undefined;
  const sub = rawSub && VALID_SUBS.has(rawSub) ? rawSub : null;

  function applySubFilter(events: CalendarEvent[]) {
    if (sub === "meus") {
      return events.filter(
        (e) =>
          e.criado_por === user.id ||
          (e.participantes_ids ?? []).includes(user.id),
      );
    }
    if (sub) return events.filter((e) => e.sub_calendar === sub);
    return events;
  }

  const subQuery = sub ? `sub=${sub}` : "";

  if (view === "month") {
    return renderMonth({ params, subQuery, sub, applySubFilter });
  }
  return renderWeek({ params, subQuery, sub, applySubFilter });
}

// ─── Week view ─────────────────────────────────────────────────────────────

async function renderWeek({
  params,
  subQuery,
  sub,
  applySubFilter,
}: {
  params: { week?: string };
  subQuery: string;
  sub: string | null;
  applySubFilter: (events: CalendarEvent[]) => CalendarEvent[];
}) {
  // Anchor a data ao meio-dia UTC pra evitar shift de timezone:
  // `new Date("2026-05-19")` = UTC midnight, que em Cuiabá (UTC-4) é
  // 2026-05-18 20:00 (domingo). Aí o getWeekRange enxerga como semana
  // anterior e a navegação next/prev fica errada. Meio-dia UTC = 8h
  // Cuiabá, mesma data em todos os fusos do hemisfério ocidental.
  const ref = params.week ? new Date(`${params.week}T12:00:00Z`) : new Date();
  const { start, end } = getWeekRange(ref);
  const todayStart = getWeekRange(new Date()).start;
  const isOnTodayWeek = start.getTime() === todayStart.getTime();

  const events = applySubFilter(await listEventsForWeek(start, end));

  const prevWeek = new Date(start);
  prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
  const nextWeek = new Date(start);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

  const prevHref = `/calendario?week=${prevWeek.toISOString().slice(0, 10)}${subQuery ? `&${subQuery}` : ""}`;
  const nextHref = `/calendario?week=${nextWeek.toISOString().slice(0, 10)}${subQuery ? `&${subQuery}` : ""}`;
  const todayHref = subQuery ? `/calendario?${subQuery}` : "/calendario";

  const formatRange = `${start.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "short" })} – ${new Date(end.getTime() - 1).toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-5">
      <Header
        title="Calendário Interno"
        subtitle={`${formatRange} · ${events.length} eventos`}
        prevHref={prevHref}
        nextHref={nextHref}
        todayHref={todayHref}
        isOnToday={isOnTodayWeek}
        view="week"
        prevLabel="Semana anterior"
        nextLabel="Próxima semana"
      />
      <SubCalendarChips current={sub} />
      <WeekView weekStart={start} events={events} />
    </div>
  );
}

// ─── Month view ────────────────────────────────────────────────────────────

async function renderMonth({
  params,
  subQuery,
  sub,
  applySubFilter,
}: {
  params: { month?: string };
  subQuery: string;
  sub: string | null;
  applySubFilter: (events: CalendarEvent[]) => CalendarEvent[];
}) {
  // `month` param é "YYYY-MM" — âncora qualquer dia do meio do mês pra evitar
  // problema de timezone com dia 1.
  const ref = params.month
    ? new Date(`${params.month}-15T12:00:00Z`)
    : new Date();
  const grid = getMonthGridRange(ref);
  const todayGrid = getMonthGridRange(new Date());
  const isOnTodayMonth =
    grid.year === todayGrid.year && grid.month === todayGrid.month;

  const events = applySubFilter(await listEventsForWeek(grid.start, grid.end));

  const prevMonth = grid.month === 1 ? 12 : grid.month - 1;
  const prevYear = grid.month === 1 ? grid.year - 1 : grid.year;
  const nextMonth = grid.month === 12 ? 1 : grid.month + 1;
  const nextYear = grid.month === 12 ? grid.year + 1 : grid.year;
  const fmt = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

  const prevHref = `/calendario?view=month&month=${fmt(prevYear, prevMonth)}${subQuery ? `&${subQuery}` : ""}`;
  const nextHref = `/calendario?view=month&month=${fmt(nextYear, nextMonth)}${subQuery ? `&${subQuery}` : ""}`;
  const todayHref = `/calendario?view=month${subQuery ? `&${subQuery}` : ""}`;

  return (
    <div className="space-y-5">
      <Header
        title="Calendário Interno"
        subtitle={`${formatMonthLabel(grid.year, grid.month)} · ${events.length} eventos`}
        prevHref={prevHref}
        nextHref={nextHref}
        todayHref={todayHref}
        isOnToday={isOnTodayMonth}
        view="month"
        prevLabel="Mês anterior"
        nextLabel="Próximo mês"
      />
      <SubCalendarChips current={sub} />
      <MonthView
        gridStart={grid.start}
        refMonth={grid.month}
        events={events}
      />
    </div>
  );
}

// ─── Shared header ─────────────────────────────────────────────────────────

function Header({
  title,
  subtitle,
  prevHref,
  nextHref,
  todayHref,
  isOnToday,
  view,
  prevLabel,
  nextLabel,
}: {
  title: string;
  subtitle: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  isOnToday: boolean;
  view: View;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={prevHref}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          aria-label={prevLabel}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        {isOnToday ? (
          <Button variant="outline" size="sm" disabled>
            Hoje
          </Button>
        ) : (
          <Link
            href={todayHref}
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            ← Hoje
          </Link>
        )}
        <Link
          href={nextHref}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          aria-label={nextLabel}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
        <ViewSwitch current={view} />
        <Link href="/calendario/novo" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo evento
        </Link>
      </div>
    </header>
  );
}
