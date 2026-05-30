// tests/unit/freelayide-urgencia.test.ts
import { describe, it, expect } from "vitest";
import { normalizeUrgencia } from "@/lib/freela-yide/schema";

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
