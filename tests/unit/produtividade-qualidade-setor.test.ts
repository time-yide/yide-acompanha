import { describe, it, expect } from "vitest";
import { computeRetrabalho, computeAprovacaoDesign, pctAprovacao } from "@/lib/produtividade/qualidade-setor";

describe("computeRetrabalho", () => {
  it("conta ajustes por dono da tarefa, ignora sem dono, ordena por mais ajustes", () => {
    const r = computeRetrabalho([
      { atribuido_a: "u1" },
      { atribuido_a: "u1" },
      { atribuido_a: "u2" },
      { atribuido_a: null },
    ]);
    expect(r).toEqual([
      { user_id: "u1", ajustes: 2 },
      { user_id: "u2", ajustes: 1 },
    ]);
  });
  it("vazio => []", () => {
    expect(computeRetrabalho([])).toEqual([]);
  });
});

describe("computeAprovacaoDesign", () => {
  it("agrupa criadas/aprovadas por criador e ordena por % aprovado", () => {
    const r = computeAprovacaoDesign([
      { criado_por: "u1", aprovada: true },
      { criado_por: "u1", aprovada: true },
      { criado_por: "u1", aprovada: false },  // u1: 2/3 = 67%
      { criado_por: "u2", aprovada: true },    // u2: 1/1 = 100%
      { criado_por: null, aprovada: true },    // ignora
    ]);
    expect(r[0]).toEqual({ user_id: "u2", criadas: 1, aprovadas: 1 }); // 100% primeiro
    expect(r[1]).toEqual({ user_id: "u1", criadas: 3, aprovadas: 2 });
  });
});

describe("pctAprovacao", () => {
  it("arredonda e trata zero", () => {
    expect(pctAprovacao(2, 3)).toBe(67);
    expect(pctAprovacao(0, 0)).toBeNull();
    expect(pctAprovacao(5, 5)).toBe(100);
  });
});
