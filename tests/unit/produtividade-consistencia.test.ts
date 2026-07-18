import { describe, it, expect } from "vitest";
import { computeConsistencia, diasUteisEntre, pctRegularidade } from "@/lib/produtividade/consistencia";

describe("computeConsistencia", () => {
  it("conta DIAS distintos com entrega por pessoa (não o total de tarefas)", () => {
    const r = computeConsistencia([
      { atribuido_a: "u1", dataLocal: "2026-07-06" },
      { atribuido_a: "u1", dataLocal: "2026-07-06" }, // mesmo dia não conta 2x
      { atribuido_a: "u1", dataLocal: "2026-07-08" },
      { atribuido_a: "u2", dataLocal: "2026-07-07" },
      { atribuido_a: null, dataLocal: "2026-07-07" }, // ignora
    ]);
    expect(r).toEqual([
      { user_id: "u1", diasComEntrega: 2 },
      { user_id: "u2", diasComEntrega: 1 },
    ]);
  });
});

describe("diasUteisEntre", () => {
  it("conta seg–sex inclusive", () => {
    // 2026-07-06 (seg) a 2026-07-10 (sex) = 5 dias úteis
    expect(diasUteisEntre("2026-07-06", "2026-07-10")).toBe(5);
    // inclui fim de semana no meio: seg 06 a seg 13 = 6 úteis (06-10 + 13)
    expect(diasUteisEntre("2026-07-06", "2026-07-13")).toBe(6);
    // um sábado só = 0
    expect(diasUteisEntre("2026-07-11", "2026-07-11")).toBe(0);
  });
  it("intervalo inválido => 0", () => {
    expect(diasUteisEntre("2026-07-10", "2026-07-06")).toBe(0);
  });
});

describe("pctRegularidade", () => {
  it("percentual, cap 100, trata zero", () => {
    expect(pctRegularidade(3, 5)).toBe(60);
    expect(pctRegularidade(6, 5)).toBe(100); // cap
    expect(pctRegularidade(1, 0)).toBeNull();
  });
});
