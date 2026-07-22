import { describe, it, expect } from "vitest";
import { destravado, PCT_MINIMO } from "./gate";

describe("destravado", () => {
  it(`libera com pct >= ${PCT_MINIMO}`, () => {
    expect(destravado(90)).toBe(true);
    expect(destravado(100)).toBe(true);
  });
  it("bloqueia abaixo do mínimo", () => {
    expect(destravado(89)).toBe(false);
    expect(destravado(0)).toBe(false);
  });
});
