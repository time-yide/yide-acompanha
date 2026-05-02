import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { listEventsForWeek, getWeekRange } from "@/lib/calendario/queries";
import type { SubCalendar } from "@/lib/calendario/schema";
import { SUB_CALENDARS } from "@/lib/calendario/schema";
import { WeekView } from "@/components/calendario/WeekView";
import { SubCalendarChips } from "@/components/calendario/SubCalendarChips";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const FILTER_KEYS = [...SUB_CALENDARS, "meus"] as const;
type FilterKey = typeof FILTER_KEYS[number];

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ week?: string; sub?: string | string[] }> }) {
  const params = await searchParams;
  const user = await requireAuth();

  const ref = params.week ? new Date(params.week) : new Date();
  const { start, end } = getWeekRange(ref);

  // Default: tudo selecionado (exceto "meus", que é opt-in).
  const filter: FilterKey[] =
    params.sub
      ? (Array.isArray(params.sub) ? params.sub : [params.sub]).filter((s): s is FilterKey =>
          (FILTER_KEYS as readonly string[]).includes(s),
        )
      : [...SUB_CALENDARS];

  const onlyMine = filter.includes("meus");
  const subFilter = filter.filter((s): s is SubCalendar => s !== "meus") as SubCalendar[];

  let events = await listEventsForWeek(start, end);
  events = events.filter((e) => subFilter.includes(e.sub_calendar));

  if (onlyMine) {
    events = events.filter(
      (e) =>
        e.criado_por === user.id ||
        (e.participantes_ids ?? []).includes(user.id),
    );
  }

  const prevWeek = new Date(start);
  prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
  const nextWeek = new Date(start);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

  const subQuery = filter.map((s) => `sub=${s}`).join("&");
  const prevHref = `/calendario?week=${prevWeek.toISOString().slice(0, 10)}&${subQuery}`;
  const nextHref = `/calendario?week=${nextWeek.toISOString().slice(0, 10)}&${subQuery}`;
  const todayHref = `/calendario?${subQuery}`;

  const formatRange = `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${new Date(end.getTime() - 1).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendário Interno</h1>
          <p className="text-sm text-muted-foreground">{formatRange} · {events.length} eventos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button render={<Link href={prevHref} />} variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button render={<Link href={todayHref} />} variant="outline" size="sm">
            Hoje
          </Button>
          <Button render={<Link href={nextHref} />} variant="outline" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button render={<Link href="/calendario/novo" />}>
            <Plus className="mr-2 h-4 w-4" />Novo evento
          </Button>
        </div>
      </header>

      <SubCalendarChips active={filter} />

      <WeekView weekStart={start} events={events} />
    </div>
  );
}
