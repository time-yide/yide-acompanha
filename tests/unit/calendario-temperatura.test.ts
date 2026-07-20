import { describe, it, expect } from "vitest";
import { aggregateTemperatura, computeTrend, type TempEvent } from "@/lib/calendario/temperatura";

// Semana de referência: 20-jul-2026 (segunda) .. 26-jul-2026 (domingo).
const team = ["ana", "bruno"];

function ev(inicio: string, fim: string, criado_por: string, participantes: string[] = []): TempEvent {
  return { inicio, fim, criado_por, participantes_ids: participantes };
}

describe("aggregateTemperatura", () => {
  it("conta eventos por dia da semana (0=seg..6=dom)", () => {
    const events: TempEvent[] = [
      ev("2026-07-20T09:00:00Z", "2026-07-20T10:00:00Z", "ana"), // seg
      ev("2026-07-20T14:00:00Z", "2026-07-20T15:00:00Z", "bruno"), // seg
      ev("2026-07-22T09:00:00Z", "2026-07-22T10:00:00Z", "ana"), // qua
    ];
    const t = aggregateTemperatura(events, team);
    expect(t.byWeekday).toEqual([2, 0, 1, 0, 0, 0, 0]);
    expect(t.totalThisWeek).toBe(3);
  });

  it("carga por pessoa: conta e soma minutos por participante OU criador, ordenado desc", () => {
    const events: TempEvent[] = [
      ev("2026-07-20T09:00:00Z", "2026-07-20T11:00:00Z", "ana", ["bruno"]), // ana(criador) + bruno(part), 120min
      ev("2026-07-21T09:00:00Z", "2026-07-21T10:00:00Z", "ana"), // ana, 60min
    ];
    const t = aggregateTemperatura(events, team);
    expect(t.byPerson).toEqual([
      { userId: "ana", count: 2, minutes: 180 },
      { userId: "bruno", count: 1, minutes: 120 },
    ]);
  });

  it("ignora quem não é do time", () => {
    const events: TempEvent[] = [
      ev("2026-07-20T09:00:00Z", "2026-07-20T10:00:00Z", "estranho", ["outro"]),
    ];
    const t = aggregateTemperatura(events, team);
    expect(t.byPerson).toEqual([]);
    // o evento ainda conta no total/dia (é da agenda do time? não — sem membro do time, não conta)
    expect(t.totalThisWeek).toBe(0);
    expect(t.byWeekday).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("horários de pico: manhã(0), tarde(1), noite(2) por dia", () => {
    const events: TempEvent[] = [
      ev("2026-07-20T09:00:00Z", "2026-07-20T10:00:00Z", "ana"), // seg manhã
      ev("2026-07-20T14:00:00Z", "2026-07-20T15:00:00Z", "ana"), // seg tarde
      ev("2026-07-20T20:00:00Z", "2026-07-20T21:00:00Z", "ana"), // seg noite
    ];
    const t = aggregateTemperatura(events, team);
    expect(t.peak[0]).toEqual([1, 1, 1]); // segunda: 1 em cada faixa
    expect(t.peak[1]).toEqual([0, 0, 0]); // terça: vazio
  });
});

describe("computeTrend", () => {
  it("compara total atual com média das semanas anteriores", () => {
    expect(computeTrend(10, [6, 8, 4, 2])).toEqual({ current: 10, avgPrevious: 5, direction: "up", deltaPct: 100 });
    expect(computeTrend(5, [10, 10, 10, 10])).toEqual({ current: 5, avgPrevious: 10, direction: "down", deltaPct: -50 });
    expect(computeTrend(5, [])).toEqual({ current: 5, avgPrevious: 0, direction: "flat", deltaPct: 0 });
  });
});
