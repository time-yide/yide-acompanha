import { describe, it, expect } from "vitest";
import { mesesRecentes, parseMes, previousMonthYM } from "@/lib/dashboard/date-utils";

const HOJE = new Date(Date.UTC(2026, 5, 4)); // 2026-06-04

describe("mesesRecentes", () => {
  it("retorna 12 meses, atual primeiro, descendente", () => {
    const r = mesesRecentes(12, HOJE);
    expect(r.length).toBe(12);
    expect(r[0]).toBe("2026-06");
    expect(r[1]).toBe("2026-05");
    expect(r[11]).toBe("2025-07");
  });
});

describe("parseMes", () => {
  it("aceita um mês dentro dos últimos 12", () => {
    expect(parseMes("2026-05", HOJE)).toBe("2026-05");
  });
  it("rejeita mês futuro -> cai no atual", () => {
    expect(parseMes("2026-07", HOJE)).toBe("2026-06");
  });
  it("rejeita mês antigo demais -> cai no atual", () => {
    expect(parseMes("2024-01", HOJE)).toBe("2026-06");
  });
  it("rejeita formato inválido/undefined -> cai no atual", () => {
    expect(parseMes("xx", HOJE)).toBe("2026-06");
    expect(parseMes(undefined, HOJE)).toBe("2026-06");
  });
});

describe("previousMonthYM", () => {
  it("vira o ano corretamente", () => {
    expect(previousMonthYM("2026-01")).toBe("2025-12");
    expect(previousMonthYM("2026-06")).toBe("2026-05");
  });
});

describe("âncora UTC-safe (consistência com mesAtual do fuso da app)", () => {
  // page.tsx ancora mesesRecentes/parseMes numa Date no meio do mês atual
  // (em UTC) pra bater com mesAtual (que vem do fuso da app). Garante que o
  // mês corrente nunca seja tratado como histórico na virada de mês.
  it("ancorado no meio do mês retorna o próprio mês como atual", () => {
    const ref = new Date("2026-06-15T12:00:00Z");
    expect(mesesRecentes(1, ref)[0]).toBe("2026-06");
    expect(parseMes(undefined, ref)).toBe("2026-06");
    expect(parseMes("2026-06", ref)).toBe("2026-06");
  });
});
