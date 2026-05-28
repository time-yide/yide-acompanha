import { describe, it, expect } from "vitest";
import { validatePdfFile, MAX_PDF_BYTES } from "@/lib/briefing-gravacao/storage";

describe("validatePdfFile", () => {
  it("rejeita tipo diferente de application/pdf", () => {
    const r = validatePdfFile({ size: 100, type: "image/png" });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/PDF/i);
  });

  it("rejeita arquivo maior que 10MB", () => {
    const r = validatePdfFile({ size: MAX_PDF_BYTES + 1, type: "application/pdf" });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/10MB/);
  });

  it("aceita PDF dentro do limite", () => {
    const r = validatePdfFile({ size: 1024, type: "application/pdf" });
    expect(r.ok).toBe(true);
    expect(r.erro).toBeUndefined();
  });

  it("aceita PDF no limite exato", () => {
    const r = validatePdfFile({ size: MAX_PDF_BYTES, type: "application/pdf" });
    expect(r.ok).toBe(true);
  });
});
