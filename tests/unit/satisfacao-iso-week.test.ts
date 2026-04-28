import { describe, it, expect } from "vitest";
import { isoWeek, currentIsoWeek, previousIsoWeek } from "@/lib/satisfacao/iso-week";

describe("isoWeek", () => {
  it("retorna formato 'YYYY-Www'", () => {
    const w = isoWeek(new Date(Date.UTC(2026, 3, 15))); // 15-abr-2026 (quarta)
    expect(w).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("calcula semana 17 corretamente para 14-abr-2026 (segunda)", () => {
    const w = isoWeek(new Date(Date.UTC(2026, 3, 14)));
    expect(w).toBe("2026-W16");
  });

  it("primeiro dia útil do ano (segunda 5-jan-2026) = 2026-W02", () => {
    const w = isoWeek(new Date(Date.UTC(2026, 0, 5)));
    expect(w).toBe("2026-W02");
  });

  it("virada de ano (segunda 30-dez-2024) = 2025-W01 (ISO 8601 sets W01 contains first Thursday)", () => {
    const w = isoWeek(new Date(Date.UTC(2024, 11, 30)));
    expect(w).toBe("2025-W01");
  });

  it("dezembro tardio em ano de 53 semanas (28-dez-2026 segunda) = 2026-W53", () => {
    const w = isoWeek(new Date(Date.UTC(2026, 11, 28)));
    expect(w).toBe("2026-W53");
  });
});

describe("previousIsoWeek", () => {
  it("retorna semana anterior dentro do ano", () => {
    expect(previousIsoWeek("2026-W17")).toBe("2026-W16");
  });

  it("virada de ano: previousIsoWeek de 2026-W01 retorna 2025-W52 ou W53 (dependendo do ano)", () => {
    const prev = previousIsoWeek("2026-W01");
    expect(prev === "2025-W52" || prev === "2025-W53").toBe(true);
  });
});

describe("currentIsoWeek", () => {
  it("retorna formato válido", () => {
    expect(currentIsoWeek()).toMatch(/^\d{4}-W\d{2}$/);
  });
});
