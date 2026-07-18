import { describe, it, expect } from "vitest";
import { calcularRival } from "@/lib/freela-yide/rivalidade";
import type { RankingEntry } from "@/lib/freela-yide/queries";

const r = (user_id: string, nome: string, pontos: number): RankingEntry => ({
  user_id, nome, pontos, fechamentos: 0, comissao: 0,
});

describe("calcularRival", () => {
  it("1º lugar => lider", () => {
    const rank = [r("u1", "Ana", 100), r("u2", "Beto", 50)];
    expect(calcularRival(rank, "u1")).toEqual({ tipo: "lider" });
  });
  it("no meio => perseguindo o de cima, faltam = diff", () => {
    const rank = [r("u1", "Ana", 100), r("u2", "Beto", 70)];
    expect(calcularRival(rank, "u2")).toEqual({ tipo: "perseguindo", nome: "Ana", faltam: 30 });
  });
  it("empate com o de cima => perseguindo, faltam 0", () => {
    const rank = [r("u1", "Ana", 100), r("u2", "Beto", 100)];
    expect(calcularRival(rank, "u2")).toEqual({ tipo: "perseguindo", nome: "Ana", faltam: 0 });
  });
  it("ausente do ranking => foraDoRanking", () => {
    const rank = [r("u1", "Ana", 100)];
    expect(calcularRival(rank, "u9")).toEqual({ tipo: "foraDoRanking" });
  });
  it("ranking vazio => foraDoRanking", () => {
    expect(calcularRival([], "u1")).toEqual({ tipo: "foraDoRanking" });
  });
});
