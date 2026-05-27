import { describe, it, expect } from "vitest";
import { parseCleanupResponse } from "@/lib/yori/services/claude-cleanup";

describe("parseCleanupResponse", () => {
  it("extrai array de palavras do response", () => {
    const raw = `[
      {"word": "Olá,", "start": 0, "end": 0.5},
      {"word": "mundo!", "start": 0.5, "end": 1}
    ]`;
    const result = parseCleanupResponse(raw);
    expect(result.ok).toBe(true);
    expect(result.words).toHaveLength(2);
    expect(result.words[0].word).toBe("Olá,");
  });

  it("aceita response com texto extra antes/depois do JSON", () => {
    const raw = `Aqui está o resultado:

[{"word": "ok", "start": 0, "end": 1}]

Espero que ajude.`;
    const result = parseCleanupResponse(raw);
    expect(result.ok).toBe(true);
    expect(result.words[0].word).toBe("ok");
  });

  it("retorna erro quando JSON malformado", () => {
    const raw = "isso não é JSON";
    const result = parseCleanupResponse(raw);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retorna erro quando array vazio", () => {
    const raw = "[]";
    const result = parseCleanupResponse(raw);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("vazio");
  });
});
