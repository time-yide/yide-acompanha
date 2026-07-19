import { describe, it, expect } from "vitest";
import { parseCasePolido } from "@/lib/seo/case-parse";
describe("parseCasePolido", () => {
  it("sanitiza e valida", () => {
    const r = parseCasePolido({ conteudo_md: "texto — aqui", meta_title: "t — x", meta_description: "d" });
    expect(r).not.toBeNull();
    expect(r!.conteudo_md.includes("—")).toBe(false);
  });
  it("null sem conteúdo", () => {
    expect(parseCasePolido({ conteudo_md: "" })).toBeNull();
    expect(parseCasePolido(null)).toBeNull();
  });
});
