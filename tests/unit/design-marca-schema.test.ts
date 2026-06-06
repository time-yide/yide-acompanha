// tests/unit/design-marca-schema.test.ts
import { describe, it, expect } from "vitest";
import { fonteFormatFromName, MARCA_FONT_EXTS } from "@/lib/design/marca-actions";

describe("fonteFormatFromName", () => {
  it("mapeia extensão pra format de @font-face", () => {
    expect(fonteFormatFromName("Marca.ttf")).toBe("truetype");
    expect(fonteFormatFromName("Marca.otf")).toBe("opentype");
    expect(fonteFormatFromName("Marca.woff")).toBe("woff");
    expect(fonteFormatFromName("Marca.woff2")).toBe("woff2");
  });
  it("retorna null pra extensão não suportada", () => {
    expect(fonteFormatFromName("Marca.png")).toBeNull();
  });
  it("MARCA_FONT_EXTS lista as extensões aceitas", () => {
    expect(MARCA_FONT_EXTS).toEqual([".ttf", ".otf", ".woff", ".woff2"]);
  });
});
