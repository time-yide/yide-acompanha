import { describe, it, expect } from "vitest";
import { compatibilidade, rankSinergiaTrabalho, rankSinergiaHobbies } from "./sinergia";

describe("compatibilidade", () => {
  it("complementares dão 'ótimo' (2)", () => {
    expect(compatibilidade("Colérico", "Melancólico")).toBe(2);
    expect(compatibilidade("Sanguíneo", "Fleumático")).toBe(2);
  });
  it("mesma classe é neutro (0)", () => {
    expect(compatibilidade("Colérico", "Colérico")).toBe(0);
  });
});

describe("rankSinergiaTrabalho", () => {
  it("ordena por compatibilidade e limita", () => {
    const eu = { userId: "me", classe: "Colérico" as const };
    const outros = [
      { userId: "a", nome: "A", avatarUrl: null, classe: "Melancólico" as const },
      { userId: "b", nome: "B", avatarUrl: null, classe: "Colérico" as const },
      { userId: "c", nome: "C", avatarUrl: null, classe: "Sanguíneo" as const },
    ];
    const r = rankSinergiaTrabalho(eu, outros, 2);
    expect(r.map((x) => x.userId)).toEqual(["a", "c"]);
    expect(r[0].motivo).toMatch(/trabalho/i);
  });
  it("sem classe retorna vazio", () => {
    expect(rankSinergiaTrabalho({ userId: "me", classe: null }, [], 3)).toEqual([]);
  });
});

describe("rankSinergiaHobbies", () => {
  it("ordena por nº de hobbies em comum e mostra as tags", () => {
    const eu = { userId: "me", hobbies: ["jogos", "musica", "corrida"] };
    const outros = [
      { userId: "a", nome: "A", avatarUrl: null, hobbies: ["jogos", "musica"] },
      { userId: "b", nome: "B", avatarUrl: null, hobbies: ["musica"] },
      { userId: "c", nome: "C", avatarUrl: null, hobbies: ["leitura"] },
    ];
    const r = rankSinergiaHobbies(eu, outros, 3);
    expect(r.map((x) => x.userId)).toEqual(["a", "b"]);
    expect(r[0].motivo).toMatch(/jogos/);
  });
});
