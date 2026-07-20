// src/components/calendario/RecurrenceFields.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

type Freq = "none" | "daily" | "weekly" | "monthly" | "yearly";
type EndKind = "forever" | "date" | "count";

const FREQ_LABELS: Record<Freq, string> = {
  none: "Não repete",
  daily: "Diariamente",
  weekly: "Semanalmente",
  monthly: "Mensalmente",
  yearly: "Anualmente",
};

// 0=seg .. 6=dom, alinhado com expandRecurrence.
const WEEKDAYS = [
  { v: 0, label: "S" }, { v: 1, label: "T" }, { v: 2, label: "Q" },
  { v: 3, label: "Q" }, { v: 4, label: "S" }, { v: 5, label: "S" }, { v: 6, label: "D" },
];

export function RecurrenceFields() {
  const [freq, setFreq] = useState<Freq>("none");
  const [endKind, setEndKind] = useState<EndKind>("forever");
  const [days, setDays] = useState<Set<number>>(new Set());

  const toggleDay = (v: number) => {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Repeat className="h-4 w-4" /> Repetir
      </div>

      <div className="space-y-2">
        <Label htmlFor="recurrence_freq">Frequência</Label>
        <select
          id="recurrence_freq"
          name="recurrence_freq"
          value={freq}
          onChange={(e) => setFreq(e.target.value as Freq)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          {(Object.keys(FREQ_LABELS) as Freq[]).map((f) => (
            <option key={f} value={f}>{FREQ_LABELS[f]}</option>
          ))}
        </select>
      </div>

      {freq !== "none" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="recurrence_interval">A cada</Label>
            <Input
              id="recurrence_interval"
              name="recurrence_interval"
              type="number"
              min={1}
              defaultValue={1}
              className="w-24"
            />
          </div>

          {freq === "weekly" && (
            <div className="space-y-2">
              <Label>Dias da semana</Label>
              <div className="flex gap-1.5">
                {WEEKDAYS.map((d, idx) => {
                  const active = days.has(d.v);
                  return (
                    <label
                      key={d.v}
                      className={cn(
                        "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border text-xs font-medium transition-colors",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted/40",
                      )}
                    >
                      <input
                        type="checkbox"
                        name="recurrence_byweekday"
                        value={d.v}
                        checked={active}
                        onChange={() => toggleDay(d.v)}
                        className="sr-only"
                      />
                      {d.label}
                      <span className="sr-only">dia {idx}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Se não escolher nenhum, usa o dia do início.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="recurrence_end_kind">Termina</Label>
            <select
              id="recurrence_end_kind"
              name="recurrence_end_kind"
              value={endKind}
              onChange={(e) => setEndKind(e.target.value as EndKind)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="forever">Nunca</option>
              <option value="date">Em uma data</option>
              <option value="count">Após N vezes</option>
            </select>
          </div>

          {endKind === "date" && (
            <div className="space-y-2">
              <Label htmlFor="recurrence_until">Até</Label>
              <Input id="recurrence_until" name="recurrence_until" type="date" className="w-48" />
            </div>
          )}

          {endKind === "count" && (
            <div className="space-y-2">
              <Label htmlFor="recurrence_count">Número de vezes</Label>
              <Input id="recurrence_count" name="recurrence_count" type="number" min={1} defaultValue={10} className="w-24" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
