import { describe, it, expect } from "vitest";
import { buildSrt, buildTxt, groupWordsIntoLines } from "@/lib/yori/srt-builder";

describe("groupWordsIntoLines", () => {
  it("agrupa palavras em linhas de até 7 palavras", () => {
    const words = Array.from({ length: 15 }, (_, i) => ({
      word: `palavra${i}`, start: i * 0.5, end: (i + 1) * 0.5,
    }));
    const lines = groupWordsIntoLines(words, 7);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0].words.length).toBeLessThanOrEqual(7);
  });

  it("respeita pausas (>1s) como quebra de linha", () => {
    const words = [
      { word: "frase", start: 0, end: 0.5 },
      { word: "um", start: 0.5, end: 1 },
      { word: "frase", start: 5, end: 5.5 },
      { word: "dois", start: 5.5, end: 6 },
    ];
    const lines = groupWordsIntoLines(words, 7);
    expect(lines).toHaveLength(2);
    expect(lines[0].words.map((w) => w.word).join(" ")).toBe("frase um");
    expect(lines[1].words.map((w) => w.word).join(" ")).toBe("frase dois");
  });

  it("retorna array vazio se sem palavras", () => {
    expect(groupWordsIntoLines([], 7)).toEqual([]);
  });
});

describe("buildSrt", () => {
  it("gera SRT válido com timestamps", () => {
    const words = [
      { word: "Olá", start: 0, end: 0.5 },
      { word: "mundo", start: 0.5, end: 1 },
    ];
    const srt = buildSrt(words);
    expect(srt).toContain("1\n");
    expect(srt).toContain("00:00:00,000 --> 00:00:01,000");
    expect(srt).toContain("Olá mundo");
  });

  it("formata timestamps no padrão SRT (HH:MM:SS,mmm)", () => {
    const words = [{ word: "x", start: 75.5, end: 76 }];
    const srt = buildSrt(words);
    expect(srt).toContain("00:01:15,500 --> 00:01:16,000");
  });

  it("numera blocos sequencialmente", () => {
    const words = [
      { word: "primeira", start: 0, end: 0.5 },
      { word: "linha", start: 0.5, end: 1 },
      { word: "segunda", start: 5, end: 5.5 },
      { word: "linha", start: 5.5, end: 6 },
    ];
    const srt = buildSrt(words);
    expect(srt).toMatch(/^1\n/);
    expect(srt).toMatch(/\n2\n/);
  });
});

describe("buildTxt", () => {
  it("retorna texto puro sem timestamps", () => {
    const words = [
      { word: "Olá,", start: 0, end: 0.5 },
      { word: "mundo!", start: 0.5, end: 1 },
    ];
    expect(buildTxt(words)).toBe("Olá, mundo!");
  });
});
