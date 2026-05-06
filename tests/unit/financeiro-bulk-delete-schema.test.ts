import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { bulkDeleteExpensesSchema, BULK_DELETE_MAX } from "@/lib/financeiro/schema";

const UUID1 = randomUUID();
const UUID2 = randomUUID();

describe("bulkDeleteExpensesSchema", () => {
  it("aceita lote válido", () => {
    const r = bulkDeleteExpensesSchema.safeParse({
      ids: [UUID1, UUID2],
      justificativa: "Limpeza trimestral",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita array vazio", () => {
    const r = bulkDeleteExpensesSchema.safeParse({ ids: [], justificativa: "qualquer" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/pelo menos uma/);
  });

  it("rejeita justificativa muito curta", () => {
    const r = bulkDeleteExpensesSchema.safeParse({
      ids: [UUID1],
      justificativa: "ab",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/mín. 3 caracteres/);
  });

  it("rejeita ID que não é UUID", () => {
    const r = bulkDeleteExpensesSchema.safeParse({
      ids: ["nao-eh-uuid"],
      justificativa: "Limpeza",
    });
    expect(r.success).toBe(false);
  });

  it("respeita o limite máximo", () => {
    const tooMany = Array.from({ length: BULK_DELETE_MAX + 1 }, () => randomUUID());
    const r = bulkDeleteExpensesSchema.safeParse({
      ids: tooMany,
      justificativa: "Limpeza",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(new RegExp(String(BULK_DELETE_MAX)));
  });

  it("aceita exatamente o limite", () => {
    const max = Array.from({ length: BULK_DELETE_MAX }, () => randomUUID());
    const r = bulkDeleteExpensesSchema.safeParse({
      ids: max,
      justificativa: "Limpeza",
    });
    expect(r.success).toBe(true);
  });

  it("trim na justificativa antes de validar tamanho", () => {
    const r = bulkDeleteExpensesSchema.safeParse({
      ids: [UUID1],
      justificativa: "   ab   ",
    });
    expect(r.success).toBe(false);
  });
});
