import { describe, it, expect } from "vitest";
import { diasNoMes } from "@/lib/painel/stories-queries";

describe("diasNoMes", () => {
  it("fevereiro não-bissexto = 28", () => {
    expect(diasNoMes("2026-02")).toBe(28);
  });

  it("fevereiro bissexto = 29", () => {
    expect(diasNoMes("2024-02")).toBe(29);
  });

  it("janeiro = 31", () => {
    expect(diasNoMes("2026-01")).toBe(31);
  });

  it("abril = 30", () => {
    expect(diasNoMes("2026-04")).toBe(30);
  });

  it("dezembro = 31 (mês 12, não vira ano)", () => {
    expect(diasNoMes("2026-12")).toBe(31);
  });
});
