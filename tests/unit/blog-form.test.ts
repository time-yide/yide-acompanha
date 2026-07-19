// tests/unit/blog-form.test.ts
import { describe, it, expect } from "vitest";
import { parseBoolCampo } from "@/lib/blog/form";

describe("parseBoolCampo", () => {
  it('"true" vira true', () => {
    expect(parseBoolCampo("true")).toBe(true);
  });

  it('"false" vira false (regressão: coerce.boolean fazia virar true)', () => {
    expect(parseBoolCampo("false")).toBe(false);
  });

  it("null vira false", () => {
    expect(parseBoolCampo(null)).toBe(false);
  });

  it("string vazia vira false", () => {
    expect(parseBoolCampo("")).toBe(false);
  });

  it("qualquer outra string vira false", () => {
    expect(parseBoolCampo("1")).toBe(false);
    expect(parseBoolCampo("sim")).toBe(false);
    expect(parseBoolCampo("TRUE")).toBe(false);
  });
});
