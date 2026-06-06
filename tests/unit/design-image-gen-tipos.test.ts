// tests/unit/design-image-gen-tipos.test.ts
import { describe, it, expect } from "vitest";
import { sizeParaFormato } from "@/lib/design/image-gen/tipos";

describe("sizeParaFormato", () => {
  it("feed é quadrado 1024x1024", () => {
    expect(sizeParaFormato("feed")).toBe("1024x1024");
  });
  it("story e reels são retrato 1024x1536", () => {
    expect(sizeParaFormato("story")).toBe("1024x1536");
    expect(sizeParaFormato("reels")).toBe("1024x1536");
  });
  it("formato desconhecido cai em quadrado", () => {
    expect(sizeParaFormato("xpto")).toBe("1024x1024");
  });
});
