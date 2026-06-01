import { describe, it, expect } from "vitest";
import { parametrosDaInstrucao, gerarPlanoBase } from "@/lib/editor-ia/services/ia-plano";
import type { WhisperWord } from "@/lib/yori/tipos";

const W = (word: string, start: number, end: number): WhisperWord => ({ word, start, end });

describe("parametrosDaInstrucao", () => {
  it("dinâmico/rápido = corte agressivo (0.5s)", () => {
    expect(parametrosDaInstrucao("deixa dinâmico").silencioMinSegundos).toBe(0.5);
    expect(parametrosDaInstrucao("corta rápido").silencioMinSegundos).toBe(0.5);
  });
  it("suave = corte leve (1.5s)", () => {
    expect(parametrosDaInstrucao("deixa suave").silencioMinSegundos).toBe(1.5);
  });
  it("default 0.8s", () => {
    expect(parametrosDaInstrucao("põe legenda").silencioMinSegundos).toBe(0.8);
  });
});

describe("gerarPlanoBase", () => {
  it("corta o gap grande e mantém as falas", () => {
    const words = [W("oi", 0, 1), W("tudo", 1.1, 2), W("bem", 5, 6)];
    const plan = gerarPlanoBase(words, { silencioMinSegundos: 0.8 });
    expect(plan.segments).toEqual([
      { start: 0, end: 2, keep: true },
      { start: 2, end: 5, keep: false },
      { start: 5, end: 6, keep: true },
    ]);
    expect(plan.captions.length).toBeGreaterThan(0);
    expect(plan.captions[0].text.length).toBeGreaterThan(0);
  });
  it("sem palavras = plano vazio", () => {
    expect(gerarPlanoBase([], { silencioMinSegundos: 0.8 })).toEqual({ segments: [], captions: [] });
  });
  it("sem gaps grandes = um único segmento keep", () => {
    const words = [W("a", 0, 1), W("b", 1.1, 2), W("c", 2.1, 3)];
    const plan = gerarPlanoBase(words, { silencioMinSegundos: 0.8 });
    expect(plan.segments).toEqual([{ start: 0, end: 3, keep: true }]);
  });
});
