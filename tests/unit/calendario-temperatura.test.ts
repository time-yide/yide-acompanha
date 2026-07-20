import { describe, it, expect } from "vitest";
import {
  aggregateTemperatura,
  computeTrend,
  getPeriodRange,
  hourOf,
  type TempEvent,
} from "@/lib/calendario/temperatura";
import { getDatePartsInAppTz } from "@/lib/datetime/timezone";

// Semana de referência: 20-jul-2026 (segunda) .. 26-jul-2026 (domingo).
// IMPORTANTE: os ISOs abaixo são UTC ("Z"), mas a bucketização acontece no
// fuso da app (Cuiabá, UTC-4). Ou seja, 13:00Z = 09:00 em Cuiabá (manhã).
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
    expect(t.total).toBe(3);
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
    expect(t.total).toBe(0);
    expect(t.byWeekday).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("mapa de calor hora-a-hora: incrementa [dia][hora] no fuso de Cuiabá", () => {
    // ISOs em UTC; horas calculadas no fuso de Cuiabá (UTC-4):
    const events: TempEvent[] = [
      ev("2026-07-20T13:00:00Z", "2026-07-20T14:00:00Z", "ana"), // 09:00 Cuiabá → seg 9h
      ev("2026-07-20T18:00:00Z", "2026-07-20T19:00:00Z", "ana"), // 14:00 Cuiabá → seg 14h
      ev("2026-07-21T00:00:00Z", "2026-07-21T01:00:00Z", "ana"), // 20:00 seg Cuiabá → seg 20h
    ];
    const t = aggregateTemperatura(events, team);
    expect(t.peakByHour[0][9]).toBe(1);
    expect(t.peakByHour[0][14]).toBe(1);
    expect(t.peakByHour[0][20]).toBe(1);
    // Nenhuma outra célula da segunda
    expect(t.peakByHour[0].reduce((s, n) => s + n, 0)).toBe(3);
    // Terça inteira vazia
    expect(t.peakByHour[1].reduce((s, n) => s + n, 0)).toBe(0);
  });

  it("bucketiza no fuso da app (Cuiabá UTC-4), não UTC cru — borda do dia", () => {
    // Evento às 20:00 de SEGUNDA no horário de Cuiabá.
    // 20:00 Cuiabá (UTC-4) = 00:00 UTC de TERÇA.
    // Com o bug (UTC cru): cairia em terça (wd=1) na hora 0.
    // Correto (fuso app): segunda (wd=0) na hora 20.
    const events: TempEvent[] = [
      ev("2026-07-21T00:00:00Z", "2026-07-21T01:00:00Z", "ana"),
    ];
    const t = aggregateTemperatura(events, team);
    // Deve contar na SEGUNDA, não na terça.
    expect(t.byWeekday).toEqual([1, 0, 0, 0, 0, 0, 0]);
    // Deve cair na hora 20 da segunda.
    expect(t.peakByHour[0][20]).toBe(1);
    expect(t.peakByHour[1].reduce((s, n) => s + n, 0)).toBe(0); // terça continua vazia
  });
});

describe("hourOf", () => {
  it("retorna a hora cheia (0..23) no fuso de Cuiabá", () => {
    expect(hourOf("2026-07-20T13:00:00Z")).toBe(9); // 09:00 Cuiabá
    expect(hourOf("2026-07-21T00:00:00Z")).toBe(20); // 20:00 seg Cuiabá
    expect(hourOf("2026-07-20T04:00:00Z")).toBe(0); // 00:00 Cuiabá
  });
});

describe("getPeriodRange", () => {
  it("week: espelha getWeekRange (segunda 00:00 fuso app)", () => {
    const { start, end } = getPeriodRange("week", new Date("2026-07-22T12:00:00Z"));
    const sp = getDatePartsInAppTz(start);
    expect(sp.weekday).toBe(1); // segunda
    expect(`${sp.hour}:${sp.minute}`).toBe("00:00");
    // 7 dias de intervalo
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("month: start é o 1º do mês 00:00 e end é o 1º do mês seguinte", () => {
    const { start, end } = getPeriodRange("month", new Date("2026-07-15T12:00:00Z"));
    const sp = getDatePartsInAppTz(start);
    expect(sp.year).toBe("2026");
    expect(sp.month).toBe("07");
    expect(sp.day).toBe("01");
    expect(`${sp.hour}:${sp.minute}`).toBe("00:00");
    const ep = getDatePartsInAppTz(end);
    expect(ep.year).toBe("2026");
    expect(ep.month).toBe("08");
    expect(ep.day).toBe("01");
    expect(`${ep.hour}:${ep.minute}`).toBe("00:00");
  });

  it("month: vira o ano corretamente (dezembro → janeiro)", () => {
    const { start, end } = getPeriodRange("month", new Date("2026-12-10T12:00:00Z"));
    const sp = getDatePartsInAppTz(start);
    expect(`${sp.year}-${sp.month}-${sp.day}`).toBe("2026-12-01");
    const ep = getDatePartsInAppTz(end);
    expect(`${ep.year}-${ep.month}-${ep.day}`).toBe("2027-01-01");
  });

  it("quarter: start é o 1º do mês inicial do trimestre e end é +3 meses", () => {
    // Julho está no Q3 (jul/ago/set) → mês inicial = 7.
    const { start, end } = getPeriodRange("quarter", new Date("2026-07-15T12:00:00Z"));
    const sp = getDatePartsInAppTz(start);
    expect(`${sp.year}-${sp.month}-${sp.day}`).toBe("2026-07-01");
    const ep = getDatePartsInAppTz(end);
    expect(`${ep.year}-${ep.month}-${ep.day}`).toBe("2026-10-01");
  });

  it("quarter: fevereiro cai no Q1 (jan/fev/mar)", () => {
    const { start, end } = getPeriodRange("quarter", new Date("2026-02-15T12:00:00Z"));
    const sp = getDatePartsInAppTz(start);
    expect(`${sp.year}-${sp.month}-${sp.day}`).toBe("2026-01-01");
    const ep = getDatePartsInAppTz(end);
    expect(`${ep.year}-${ep.month}-${ep.day}`).toBe("2026-04-01");
  });
});

describe("computeTrend", () => {
  it("compara total atual com média das semanas anteriores", () => {
    expect(computeTrend(10, [6, 8, 4, 2])).toEqual({ current: 10, avgPrevious: 5, direction: "up", deltaPct: 100 });
    expect(computeTrend(5, [10, 10, 10, 10])).toEqual({ current: 5, avgPrevious: 10, direction: "down", deltaPct: -50 });
    expect(computeTrend(5, [])).toEqual({ current: 5, avgPrevious: 0, direction: "flat", deltaPct: 0 });
  });
});
