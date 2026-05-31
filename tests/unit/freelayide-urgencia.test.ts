// tests/unit/freelayide-urgencia.test.ts
import { describe, it, expect } from "vitest";
import { normalizeUrgencia, criarOportunidadeSchema } from "@/lib/freela-yide/schema";

describe("normalizeUrgencia", () => {
  it("zera urgência quando tipo não é edicao", () => {
    expect(normalizeUrgencia("captacao", true, "2026-06-20T14:00")).toEqual({
      entrega_urgente: false,
      prazo_entrega: null,
    });
  });
  it("mantém urgência quando tipo é edicao", () => {
    expect(normalizeUrgencia("edicao", true, "2026-06-20T14:00")).toEqual({
      entrega_urgente: true,
      prazo_entrega: "2026-06-20T14:00",
    });
  });
  it("edicao sem urgência marca false e prazo null", () => {
    expect(normalizeUrgencia("edicao", false, null)).toEqual({
      entrega_urgente: false,
      prazo_entrega: null,
    });
  });
});

describe("criarOportunidadeSchema - prazo_entrega validation", () => {
  const base = { titulo: "Test", valor_comissao: 100, tipo: "edicao" };

  it("accepts valid prazo_entrega without seconds", () => {
    const result = criarOportunidadeSchema.safeParse({ ...base, prazo_entrega: "2026-06-20T14:00" });
    expect(result.success).toBe(true);
  });

  it("accepts valid prazo_entrega with seconds", () => {
    const result = criarOportunidadeSchema.safeParse({ ...base, prazo_entrega: "2026-06-20T14:00:00" });
    expect(result.success).toBe(true);
  });

  it("accepts missing prazo_entrega (optional)", () => {
    const result = criarOportunidadeSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts null prazo_entrega", () => {
    const result = criarOportunidadeSchema.safeParse({ ...base, prazo_entrega: null });
    expect(result.success).toBe(true);
  });

  it("rejects malformed prazo_entrega", () => {
    const result = criarOportunidadeSchema.safeParse({ ...base, prazo_entrega: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Prazo inválido");
    }
  });

  it("rejects date-only prazo_entrega (missing time)", () => {
    const result = criarOportunidadeSchema.safeParse({ ...base, prazo_entrega: "2026-06-20" });
    expect(result.success).toBe(false);
  });
});
