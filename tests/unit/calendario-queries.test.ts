import { describe, it, expect, vi } from "vitest";

// Import only pure functions (avoid server-side code)
function computeBirthdayThisYear(birthDateISO: string, today: Date = new Date()): Date {
  const [year, month, day] = birthDateISO.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Data inválida");

  const HOUR = 60 * 60 * 1000;
  const thisYear = new Date(Date.UTC(today.getUTCFullYear(), month - 1, day, 12, 0, 0));
  if (thisYear.getTime() < today.getTime() - 24 * HOUR) {
    return new Date(Date.UTC(today.getUTCFullYear() + 1, month - 1, day, 12, 0, 0));
  }
  return thisYear;
}

function eventOverlapsWeek(
  inicioISO: string, fimISO: string, weekStart: Date, weekEnd: Date,
): boolean {
  const start = new Date(inicioISO).getTime();
  const end = new Date(fimISO).getTime();
  return start < weekEnd.getTime() && end > weekStart.getTime();
}

describe("computeBirthdayThisYear", () => {
  it("retorna a próxima ocorrência do aniversário em ano corrente ou futuro", () => {
    const today = new Date("2026-05-15T12:00:00Z");
    const next = computeBirthdayThisYear("2000-08-22", today);
    expect(next.toISOString().slice(0, 10)).toBe("2026-08-22");
  });

  it("se aniversário já passou neste ano, retorna do próximo ano", () => {
    const today = new Date("2026-12-15T12:00:00Z");
    const next = computeBirthdayThisYear("2000-03-10", today);
    expect(next.toISOString().slice(0, 10)).toBe("2027-03-10");
  });

  it("aniversário hoje → retorna hoje", () => {
    const today = new Date("2026-05-15T12:00:00Z");
    const next = computeBirthdayThisYear("1990-05-15", today);
    expect(next.toISOString().slice(0, 10)).toBe("2026-05-15");
  });
});

describe("eventOverlapsWeek", () => {
  const weekStart = new Date("2026-04-27T00:00:00Z");
  const weekEnd = new Date("2026-05-04T00:00:00Z");

  it("evento dentro da semana → true", () => {
    expect(eventOverlapsWeek("2026-04-29T14:00:00Z", "2026-04-29T15:00:00Z", weekStart, weekEnd)).toBe(true);
  });

  it("evento antes da semana → false", () => {
    expect(eventOverlapsWeek("2026-04-20T14:00:00Z", "2026-04-20T15:00:00Z", weekStart, weekEnd)).toBe(false);
  });

  it("evento depois da semana → false", () => {
    expect(eventOverlapsWeek("2026-05-10T14:00:00Z", "2026-05-10T15:00:00Z", weekStart, weekEnd)).toBe(false);
  });

  it("evento que cruza início da semana → true", () => {
    expect(eventOverlapsWeek("2026-04-26T22:00:00Z", "2026-04-27T01:00:00Z", weekStart, weekEnd)).toBe(true);
  });
});
