import { EventCell } from "./EventCell";
import type { CalendarEvent } from "@/lib/calendario/schema";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface Props {
  weekStart: Date;
  events: CalendarEvent[];
}

export function WeekView({ weekStart, events }: Props) {
  const groups: CalendarEvent[][] = [[], [], [], [], [], [], []];
  for (const e of events) {
    const d = new Date(e.inicio);
    const dayIdx = (d.getUTCDay() + 6) % 7;
    if (dayIdx >= 0 && dayIdx < 7) groups[dayIdx].push(e);
  }

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return (
    <div className="grid grid-cols-7 gap-2">
      {dates.map((d, i) => {
        const isToday = d.getTime() === today.getTime();
        return (
          <div key={i} className="space-y-2">
            <div className={`rounded-md border bg-card px-3 py-2 ${isToday ? "border-primary text-primary" : ""}`}>
              <div className="text-[11px] font-semibold uppercase tracking-wider">{DAYS[i]}</div>
              <div className="text-lg font-bold tabular-nums">
                {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </div>
            </div>

            <div className="min-h-[200px] space-y-1.5 rounded-md bg-muted/20 p-1.5">
              {groups[i].length === 0 ? (
                <p className="px-1 py-2 text-center text-[10px] text-muted-foreground">—</p>
              ) : (
                groups[i].map((e) => <EventCell key={e.id} event={e} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
