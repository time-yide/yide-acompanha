// tests/unit/blog-leitura.test.ts
import { describe, it, expect } from "vitest";
import { tempoLeituraMin } from "@/lib/blog/leitura";

describe("tempoLeituraMin", () => {
  it("mínimo de 1 min mesmo com texto curto ou vazio", () => {
    expect(tempoLeituraMin("")).toBe(1);
    expect(tempoLeituraMin("oi mundo")).toBe(1);
  });
  it("~200 palavras/min", () => {
    expect(tempoLeituraMin(Array(200).fill("palavra").join(" "))).toBe(1);
    expect(tempoLeituraMin(Array(600).fill("palavra").join(" "))).toBe(3);
  });
  it("arredonda pro minuto mais próximo", () => {
    expect(tempoLeituraMin(Array(500).fill("x").join(" "))).toBe(3); // 2.5 → 3
  });
});
