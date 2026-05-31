import { describe, it, expect } from "vitest";
import { criarVisitaSchema, adicionarLeadVisitaSchema } from "@/lib/visitas/schema";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("criarVisitaSchema", () => {
  it("aceita data + titulo", () => {
    expect(criarVisitaSchema.safeParse({ data: "2026-06-01", titulo: "Centro manha" }).success).toBe(true);
  });
  it("rejeita sem titulo", () => {
    expect(criarVisitaSchema.safeParse({ data: "2026-06-01" }).success).toBe(false);
  });
  it("rejeita data invalida", () => {
    expect(criarVisitaSchema.safeParse({ data: "01/06/2026", titulo: "X" }).success).toBe(false);
  });
});

describe("adicionarLeadVisitaSchema", () => {
  it("aceita empresa + visita_id", () => {
    expect(adicionarLeadVisitaSchema.safeParse({ visita_id: UUID, empresa: "Padaria X", telefone: "1133334444" }).success).toBe(true);
  });
  it("rejeita sem empresa", () => {
    expect(adicionarLeadVisitaSchema.safeParse({ visita_id: UUID }).success).toBe(false);
  });
});
