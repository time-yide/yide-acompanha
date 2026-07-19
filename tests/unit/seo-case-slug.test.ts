import { describe, it, expect } from "vitest";
import { baseSlugCase } from "@/lib/seo/case-slug";
describe("baseSlugCase", () => {
  it("usa cliente e segmento", () => {
    expect(baseSlugCase("Kumon", "Educação")).toBe("kumon-educacao");
  });
  it("só cliente quando sem segmento", () => {
    expect(baseSlugCase("Nazca", "")).toBe("nazca");
  });
});
