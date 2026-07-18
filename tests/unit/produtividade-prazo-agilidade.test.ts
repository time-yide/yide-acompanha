import { describe, it, expect } from "vitest";
import { computePrazoAgilidade, resumoPrazoAgilidade, pctPrazo, type TaskPrazoRow } from "@/lib/produtividade/prazo-agilidade";

const t = (atribuido_a: string, created_at: string, completed_at: string, due_date: string | null): TaskPrazoRow =>
  ({ atribuido_a, created_at, completed_at, due_date });

describe("computePrazoAgilidade", () => {
  it("agrupa por pessoa: entregues, com/no prazo e lead time médio", () => {
    const rows = [
      // Ana: 1 no prazo (concluiu 05, prazo 06), lead 2 dias
      t("u1", "2026-07-03T12:00:00.000Z", "2026-07-05T12:00:00.000Z", "2026-07-06"),
      // Ana: 1 atrasada (concluiu 10, prazo 08), lead 4 dias
      t("u1", "2026-07-06T12:00:00.000Z", "2026-07-10T12:00:00.000Z", "2026-07-08"),
      // Beto: sem due_date (não conta pra prazo), lead 1 dia
      t("u2", "2026-07-01T12:00:00.000Z", "2026-07-02T12:00:00.000Z", null),
    ];
    const byId = Object.fromEntries(computePrazoAgilidade(rows).map((p) => [p.user_id, p]));
    expect(byId.u1.entregues).toBe(2);
    expect(byId.u1.com_prazo).toBe(2);
    expect(byId.u1.no_prazo).toBe(1);
    expect(byId.u1.leadTimeMedioDias).toBeCloseTo(3, 5); // (2 + 4) / 2
    expect(byId.u2.entregues).toBe(1);
    expect(byId.u2.com_prazo).toBe(0);
    expect(byId.u2.no_prazo).toBe(0);
    expect(byId.u2.leadTimeMedioDias).toBeCloseTo(1, 5);
  });

  it("no prazo = concluída no mesmo dia do due_date conta como no prazo", () => {
    const [p] = computePrazoAgilidade([t("u1", "2026-07-01T00:00:00.000Z", "2026-07-06T23:00:00.000Z", "2026-07-06")]);
    expect(p.no_prazo).toBe(1);
  });

  it("ignora linhas sem atribuido_a ou sem completed_at", () => {
    const rows = [
      { atribuido_a: "", created_at: "2026-07-01T00:00:00.000Z", completed_at: "2026-07-02T00:00:00.000Z", due_date: null },
      { atribuido_a: "u1", created_at: "2026-07-01T00:00:00.000Z", completed_at: "", due_date: null },
    ] as TaskPrazoRow[];
    expect(computePrazoAgilidade(rows)).toEqual([]);
  });
});

describe("pctPrazo", () => {
  it("arredonda e trata sem prazo", () => {
    expect(pctPrazo(9, 10)).toBe(90);
    expect(pctPrazo(1, 3)).toBe(33);
    expect(pctPrazo(0, 0)).toBeNull();
  });
});

describe("resumoPrazoAgilidade", () => {
  it("soma o time e pondera o lead time por entregas", () => {
    const pessoas = [
      { user_id: "u1", entregues: 2, com_prazo: 2, no_prazo: 1, leadTimeMedioDias: 3 },
      { user_id: "u2", entregues: 1, com_prazo: 0, no_prazo: 0, leadTimeMedioDias: 1 },
    ];
    const r = resumoPrazoAgilidade(pessoas);
    expect(r.entregues).toBe(3);
    expect(r.com_prazo).toBe(2);
    expect(r.no_prazo).toBe(1);
    expect(r.pct).toBe(50);
    expect(r.leadTimeMedioDias).toBeCloseTo((3 * 2 + 1 * 1) / 3, 5); // 7/3
  });
});
