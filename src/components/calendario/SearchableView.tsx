"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import type { CalendarEvent } from "@/lib/calendario/schema";

function SearchInput({
  query,
  onChange,
  resultCount,
  totalCount,
}: {
  query: string;
  onChange: (q: string) => void;
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative max-w-xs flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar evento..."
          value={query}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border bg-card py-2 pl-9 pr-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {query && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {query.trim() && (
        <span className="text-xs text-muted-foreground">
          {resultCount} de {totalCount}
        </span>
      )}
    </div>
  );
}

function filterEvents(events: CalendarEvent[], query: string): CalendarEvent[] {
  if (!query.trim()) return events;
  const q = query.toLowerCase().trim();
  return events.filter((e) => {
    const parts = [
      e.titulo,
      e.videomaker_assigned_nome,
      e.bloqueio?.videomaker_nome,
      e.freela?.dono_nome,
    ];
    return parts.some((p) => p && p.toLowerCase().includes(q));
  });
}

export function SearchableWeekView({
  weekStart,
  events,
  podeGravar,
}: {
  weekStart: Date;
  events: CalendarEvent[];
  podeGravar: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterEvents(events, query), [events, query]);

  return (
    <div className="space-y-3">
      <SearchInput query={query} onChange={setQuery} resultCount={filtered.length} totalCount={events.length} />
      <WeekView weekStart={weekStart} events={filtered} podeGravar={podeGravar} />
    </div>
  );
}

export function SearchableMonthView({
  gridStart,
  refMonth,
  events,
}: {
  gridStart: Date;
  refMonth: number;
  events: CalendarEvent[];
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterEvents(events, query), [events, query]);

  return (
    <div className="space-y-3">
      <SearchInput query={query} onChange={setQuery} resultCount={filtered.length} totalCount={events.length} />
      <MonthView gridStart={gridStart} refMonth={refMonth} events={filtered} />
    </div>
  );
}
