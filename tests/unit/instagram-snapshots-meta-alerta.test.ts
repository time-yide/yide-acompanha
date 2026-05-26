import { describe, it, expect } from "vitest";
import { evaluateMeta, diasNoMes } from "@/lib/instagram-snapshots/meta-alerta";

describe("diasNoMes", () => {
  it("retorna 31 pra Janeiro", () => {
    expect(diasNoMes(2026, 1)).toBe(31);
  });
  it("retorna 28 pra Fevereiro de 2026 (não bissexto)", () => {
    expect(diasNoMes(2026, 2)).toBe(28);
  });
  it("retorna 29 pra Fevereiro de 2024 (bissexto)", () => {
    expect(diasNoMes(2024, 2)).toBe(29);
  });
  it("retorna 30 pra Abril", () => {
    expect(diasNoMes(2026, 4)).toBe(30);
  });
});

describe("evaluateMeta", () => {
  it("sem_meta quando metaMes é null", () => {
    const r = evaluateMeta({ metaMes: null, postsMes: 5, diaAtual: 10, diasNoMes: 31 });
    expect(r.status).toBe("sem_meta");
    expect(r.projecao).toBeNull();
    expect(r.pctMeta).toBeNull();
  });

  it("sem_meta quando metaMes é 0", () => {
    const r = evaluateMeta({ metaMes: 0, postsMes: 5, diaAtual: 10, diasNoMes: 31 });
    expect(r.status).toBe("sem_meta");
  });

  it("nos primeiros 2 dias retorna ok sem projetar (ritmo instável)", () => {
    const r = evaluateMeta({ metaMes: 20, postsMes: 0, diaAtual: 1, diasNoMes: 31 });
    expect(r.status).toBe("ok");
    expect(r.projecao).toBeNull();
    expect(r.pctMeta).toBe(0);
  });

  it("crítico: ritmo atual projeta menos de 70% da meta", () => {
    // Meta 20, dia 10/30, fez 3 → projeção = 3/10 × 30 = 9 → 9/20 = 45% → crítico
    const r = evaluateMeta({ metaMes: 20, postsMes: 3, diaAtual: 10, diasNoMes: 30 });
    expect(r.status).toBe("critico");
    expect(r.projecao).toBe(9);
    expect(r.faltam).toBe(17);
  });

  it("atenção: ritmo projeta entre 70% e 90%", () => {
    // Meta 20, dia 15/30, fez 8 → projeção = 16 → 80% → atenção
    const r = evaluateMeta({ metaMes: 20, postsMes: 8, diaAtual: 15, diasNoMes: 30 });
    expect(r.status).toBe("atencao");
    expect(r.projecao).toBe(16);
  });

  it("ok: ritmo projeta >= 90% da meta", () => {
    // Meta 20, dia 15/30, fez 10 → projeção = 20 → 100% → ok
    const r = evaluateMeta({ metaMes: 20, postsMes: 10, diaAtual: 15, diasNoMes: 30 });
    expect(r.status).toBe("ok");
    expect(r.projecao).toBe(20);
  });

  it("ok quando já bateu a meta antes do mês acabar", () => {
    const r = evaluateMeta({ metaMes: 20, postsMes: 25, diaAtual: 20, diasNoMes: 30 });
    expect(r.status).toBe("ok");
    expect(r.faltam).toBe(0);
  });

  it("faltam reflete posts pendentes pra meta", () => {
    const r = evaluateMeta({ metaMes: 20, postsMes: 7, diaAtual: 15, diasNoMes: 30 });
    expect(r.faltam).toBe(13);
  });
});
