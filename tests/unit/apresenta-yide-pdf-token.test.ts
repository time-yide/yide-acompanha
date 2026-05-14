import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { signPdfToken, verifyPdfToken } from "@/lib/apresenta-yide/pdf-token";

const SECRET = "test-secret-1234567890";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-14T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("signPdfToken / verifyPdfToken", () => {
  it("token gerado é verificável com mesmo segredo", () => {
    const token = signPdfToken("apresentacao-123", SECRET);
    expect(verifyPdfToken("apresentacao-123", token, SECRET)).toBe(true);
  });

  it("rejeita token com segredo diferente", () => {
    const token = signPdfToken("apresentacao-123", SECRET);
    expect(verifyPdfToken("apresentacao-123", token, "outro-segredo")).toBe(false);
  });

  it("rejeita token usado com id diferente", () => {
    const token = signPdfToken("apresentacao-123", SECRET);
    expect(verifyPdfToken("outra-id", token, SECRET)).toBe(false);
  });

  it("rejeita token expirado (>5 min)", () => {
    const token = signPdfToken("apresentacao-123", SECRET);
    vi.advanceTimersByTime(6 * 60 * 1000); // 6 min
    expect(verifyPdfToken("apresentacao-123", token, SECRET)).toBe(false);
  });

  it("aceita token dentro da janela de 5 min", () => {
    const token = signPdfToken("apresentacao-123", SECRET);
    vi.advanceTimersByTime(4 * 60 * 1000); // 4 min
    expect(verifyPdfToken("apresentacao-123", token, SECRET)).toBe(true);
  });

  it("rejeita token malformado", () => {
    expect(verifyPdfToken("apresentacao-123", "lixo", SECRET)).toBe(false);
    expect(verifyPdfToken("apresentacao-123", "", SECRET)).toBe(false);
    expect(verifyPdfToken("apresentacao-123", "a.b", SECRET)).toBe(false);
  });
});
