// tests/unit/design-studio-tipos.test.ts
import { describe, it, expect } from "vitest";
import { FORMAT_DIMS, dimensoesDoFormato } from "@/lib/design/studio-tipos";

describe("FORMAT_DIMS", () => {
  it("feed é 1080x1080", () => {
    expect(FORMAT_DIMS.feed).toEqual({ w: 1080, h: 1080 });
  });
  it("story e reels são 1080x1920", () => {
    expect(FORMAT_DIMS.story).toEqual({ w: 1080, h: 1920 });
    expect(FORMAT_DIMS.reels).toEqual({ w: 1080, h: 1920 });
  });
});

describe("dimensoesDoFormato", () => {
  it("retorna as dimensões do formato conhecido", () => {
    expect(dimensoesDoFormato("story")).toEqual({ w: 1080, h: 1920 });
  });
  it("cai em feed pra formato desconhecido", () => {
    expect(dimensoesDoFormato("xpto")).toEqual({ w: 1080, h: 1080 });
  });
});
