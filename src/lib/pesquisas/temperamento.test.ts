import { describe, it, expect } from "vitest";
import { letraDaOpcao, ehQuizTemperamento, calcularTemperamento } from "./temperamento";

describe("letraDaOpcao", () => {
  it("extrai a letra do prefixo", () => {
    expect(letraDaOpcao("A) Assumo a liderança")).toBe("A");
    expect(letraDaOpcao("d) Espero entender")).toBe("D");
    expect(letraDaOpcao("Sem letra")).toBe(null);
  });
});

describe("ehQuizTemperamento", () => {
  it("true quando todas múltipla com A)..D)", () => {
    const perguntas = [
      { tipo: "multipla_escolha", opcoes: ["A) x", "B) y", "C) z", "D) w"] },
      { tipo: "multipla_escolha", opcoes: ["A) x", "B) y"] },
    ];
    expect(ehQuizTemperamento(perguntas)).toBe(true);
  });
  it("false se tem pergunta de texto", () => {
    expect(ehQuizTemperamento([{ tipo: "texto", opcoes: null }])).toBe(false);
  });
  it("false se opção não tem letra", () => {
    expect(ehQuizTemperamento([{ tipo: "multipla_escolha", opcoes: ["Sim", "Não"] }])).toBe(false);
  });
});

describe("calcularTemperamento", () => {
  it("conta e acha a predominante", () => {
    const r = calcularTemperamento(["A) x", "A) y", "A) z", "B) w", "C) k", "D) j"]);
    expect(r.contagem).toEqual({ A: 3, B: 1, C: 1, D: 1 });
    expect(r.predominante).toBe("A");
  });
  it("sem escolhas → predominante null", () => {
    expect(calcularTemperamento([]).predominante).toBe(null);
  });
});
