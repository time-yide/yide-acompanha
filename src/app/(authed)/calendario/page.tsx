import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { listEventsForWeek, getWeekRange } from "@/lib/calendario/queries";
import { SUB_CALENDARS } from "@/lib/calendario/schema";
import { WeekView } from "@/components/calendario/WeekView";
import { SubCalendarChips } from "@/components/calendario/SubCalendarChips";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

const VALID_SUBS: ReadonlySet<string> = new Set([...SUB_CALENDARS, "meus"]);

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ week?: string; sub?: string | string[] }> }) {
  const params = await searchParams;
  const user = await requireAuth();

  const ref = params.week ? new Date(params.week) : new Date();
  const { start, end } = getWeekRange(ref);
  const todayStart = getWeekRange(new Date()).start;
  const isOnTodayWeek = start.getTime() === todayStart.getTime();

  // Radio: um valor só. Aceita string ou string[] (compatibilidade com URLs antigas).
  const rawSub = typeof params.sub === "string"
    ? params.sub
    : Array.isArray(params.sub) ? params.sub[0] : undefined;
  const sub = rawSub && VALID_SUBS.has(rawSub) ? rawSub : null;

  let events = await listEventsForWeek(start, end);
  if (sub === "meus") {
    events = events.filter(
      (e) =>
        e.criado_por === user.id ||
        (e.participantes_ids ?? []).includes(user.id),
    );
  } else if (sub) {
    events = events.filter((e) => e.sub_calendar === sub);
  }
  // sub === null → mostra tudo, sem filtro

  const prevWeek = new Date(start);
  prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
  const nextWeek = new Date(start);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

  const subQuery = sub ? `sub=${sub}` : "";
  const prevHref = `/calendario?week=${prevWeek.toISOString().slice(0, 10)}${subQuery ? `&${subQuery}` : ""}`;
  const nextHref = `/calendario?week=${nextWeek.toISOString().slice(0, 10)}${subQuery ? `&${subQuery}` : ""}`;
  const todayHref = subQuery ? `/calendario?${subQuery}` : "/calendario";

  const formatRange = `${start.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "short" })} – ${new Date(end.getTime() - 1).toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendário Interno</h1>
          <p className="text-sm text-muted-foreground">{formatRange} · {events.length} eventos</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={prevHref}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {isOnTodayWeek ? (
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
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/calendario/novo" className={buttonVariants()}>
            <Plus className="mr-2 h-4 w-4" />Novo evento
          </Link>
        </div>
      </header>

      <SubCalendarChips current={sub} />

      <WeekView weekStart={start} events={events} />
    </div>
  );
}
