import { describe, expect, it } from "vitest";
import { periodoPadrao, periodoAnterior, diasEntre } from "./periodo";

describe("dados/periodo", () => {
  it("padrão = 30 dias terminando ontem", () => {
    expect(periodoPadrao(new Date("2026-11-22T12:00:00-03:00"))).toEqual({ de: "2026-10-23", ate: "2026-11-21" });
  });
  it("anterior tem o mesmo tamanho", () => {
    expect(periodoAnterior({ de: "2026-10-23", ate: "2026-11-21" })).toEqual({ de: "2026-09-23", ate: "2026-10-22" });
  });
  it("dias entre", () => {
    expect(diasEntre(new Date("2026-11-18T10:00:00Z"), new Date("2026-11-22T10:00:00Z"))).toBe(4);
  });
});
