import { describe, it, expect } from "vitest";
import { monthRange, monthLabel, lastDayOfMonth, isInMonth } from "@/lib/dashboard/date-utils";

describe("monthRange", () => {
  it("retorna últimos 12 meses incluindo o atual em ordem cronológica", () => {
    const months = monthRange(12, new Date(Date.UTC(2026, 3, 28)));
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-05");
    expect(months[11]).toBe("2026-04");
  });

  it("retorna últimos 6 meses", () => {
    const months = monthRange(6, new Date(Date.UTC(2026, 3, 28)));
    expect(months).toEqual(["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"]);
  });

  it("vira o ano corretamente", () => {
    const months = monthRange(3, new Date(Date.UTC(2026, 1, 15)));
    expect(months).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});

describe("monthLabel", () => {
  it("formata 'YYYY-MM' como 'Mês/AAAA' em pt-BR abreviado", () => {
    expect(monthLabel("2026-04")).toBe("Abr/2026");
    expect(monthLabel("2025-12")).toBe("Dez/2025");
  });
});

describe("lastDayOfMonth", () => {
  it("retorna último dia do mês como ISO date 'YYYY-MM-DD'", () => {
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
    expect(lastDayOfMonth("2024-02")).toBe("2024-02-29"); // ano bissexto
    expect(lastDayOfMonth("2026-12")).toBe("2026-12-31");
  });
});

describe("isInMonth", () => {
  it("retorna true se a data ISO está no mês especificado", () => {
    expect(isInMonth("2026-04-15", "2026-04")).toBe(true);
    expect(isInMonth("2026-04-01", "2026-04")).toBe(true);
    expect(isInMonth("2026-04-30", "2026-04")).toBe(true);
  });

  it("retorna false fora do mês", () => {
    expect(isInMonth("2026-03-31", "2026-04")).toBe(false);
    expect(isInMonth("2026-05-01", "2026-04")).toBe(false);
  });

  it("retorna false se data for null/undefined", () => {
    expect(isInMonth(null, "2026-04")).toBe(false);
    expect(isInMonth(undefined, "2026-04")).toBe(false);
  });
});
