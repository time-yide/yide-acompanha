import { useMemo } from "react";
import { EventCell } from "./EventCell";
import type { CalendarEvent } from "@/lib/calendario/schema";
import { getBrtDayOfWeek } from "@/lib/calendario/timezone";
import { APP_TIMEZONE, getAppTimezoneOffsetMs, getDatePartsInAppTz } from "@/lib/datetime/timezone";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface Props {
  weekStart: Date;
  events: CalendarEvent[];
}

export function WeekView({ weekStart, events }: Props) {
  const groups: CalendarEvent[][] = [[], [], [], [], [], [], []];
  for (const e of events) {
    // dayIdx 0 = Segunda em nossa convenção (DAYS array começa em Seg)
    const dayIdx = (getBrtDayOfWeek(e.inicio) + 6) % 7;
    if (dayIdx >= 0 && dayIdx < 7) groups[dayIdx].push(e);
  }

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d);
  }

  const todayUtc = useMemo(() => {
    // "Hoje" calculado no fuso da app (Cuiabá UTC-4), convertido pra ms UTC
    // pra comparar com dates[] que estão em UTC.
    const parts = getDatePartsInAppTz(new Date());
    const y = parseInt(parts.year, 10);
    const m = parseInt(parts.month, 10);
    const d = parseInt(parts.day, 10);
    const offsetMs = getAppTimezoneOffsetMs();
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) + offsetMs);
  }, []);

  return (
    // Mobile (< sm): lista vertical de 7 dias full-width — eventos legíveis.
    // sm+: grid 7 colunas como antes pra visão semanal compacta.
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {dates.map((d, i) => {
        const isToday = d.getTime() === todayUtc.getTime();
        const isEmpty = groups[i].length === 0;
        return (
          <div key={i} className="space-y-2">
            {/* Header do dia: horizontal no mobile (DOM dia compacto), vertical no desktop */}
            <div
              className={`flex items-baseline gap-2 rounded-md border bg-card px-3 py-2 sm:block sm:gap-0 ${
                isToday ? "border-primary text-primary" : ""
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider">{DAYS[i]}</div>
              <div className="text-lg font-bold tabular-nums">
                {d.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit" })}
              </div>
              {/* Contador inline no mobile pra dia vazio ficar evidente sem ocupar coluna inteira */}
              {isEmpty && (
                <span className="ml-auto text-xs text-muted-foreground sm:hidden">sem eventos</span>
              )}
            </div>

            {/* No mobile, dia vazio não mostra container vazio (já tem o "sem eventos" no header). */}
            {!isEmpty && (
              <div className="space-y-1.5 rounded-md bg-muted/20 p-1.5 sm:min-h-[200px]">
                {groups[i].map((e) => <EventCell key={e.id} event={e} />)}
              </div>
            )}
            {/* No desktop, dia vazio mostra container com placeholder pra manter altura uniforme. */}
            {isEmpty && (
              <div className="hidden min-h-[200px] space-y-1.5 rounded-md bg-muted/20 p-1.5 sm:block">
                <p className="px-1 py-2 text-center text-[10px] text-muted-foreground">Sem eventos</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
