// tests/unit/ligar-lead-schema.test.ts
import { describe, it, expect } from "vitest";
import { registrarLigacaoLeadSchema, resultadoLigacaoSchema } from "@/lib/ligacoes/schema";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("registrarLigacaoLeadSchema", () => {
  it("aceita número + lead válidos", () => {
    const r = registrarLigacaoLeadSchema.safeParse({ numero: "+5511999998888", lead_gerado_id: UUID });
    expect(r.success).toBe(true);
  });
  it("aceita contato_nome opcional", () => {
    const r = registrarLigacaoLeadSchema.safeParse({ numero: "1133334444", lead_gerado_id: UUID, contato_nome: "Padaria X" });
    expect(r.success).toBe(true);
  });
  it("rejeita número curto", () => {
    const r = registrarLigacaoLeadSchema.safeParse({ numero: "123", lead_gerado_id: UUID });
    expect(r.success).toBe(false);
  });
  it("rejeita lead_gerado_id inválido", () => {
    const r = registrarLigacaoLeadSchema.safeParse({ numero: "1133334444", lead_gerado_id: "nope" });
    expect(r.success).toBe(false);
  });
});

describe("resultadoLigacaoSchema", () => {
  it("aceita status válido", () => {
    expect(resultadoLigacaoSchema.safeParse({ id: UUID, status: "atendida" }).success).toBe(true);
    expect(resultadoLigacaoSchema.safeParse({ id: UUID, status: "caixa_postal" }).success).toBe(true);
  });
  it("rejeita status inválido", () => {
    expect(resultadoLigacaoSchema.safeParse({ id: UUID, status: "xpto" }).success).toBe(false);
  });
});
