import { describe, it, expect } from "vitest";
import { wordsToSegments } from "./transcript";

describe("wordsToSegments", () => {
  it("agrupa palavras em segmentos por janela de tempo", () => {
    const words = [
      { word: "Oi", start: 0, end: 0.5 },
      { word: "tudo", start: 0.6, end: 1.0 },
      { word: "bem", start: 1.1, end: 1.5 },
      { word: "então", start: 20, end: 20.4 },
      { word: "vamos", start: 20.5, end: 21 },
    ];
    const segs = wordsToSegments(words, 12);
    expect(segs.length).toBe(2);
    expect(segs[0].text).toBe("Oi tudo bem");
    expect(segs[0].start).toBe(0);
    expect(segs[1].text).toBe("então vamos");
    expect(segs[1].start).toBe(20);
    expect(segs[0].speaker_id).toBeNull();
  });
  it("lista vazia → []", () => {
    expect(wordsToSegments([], 12)).toEqual([]);
  });
});
