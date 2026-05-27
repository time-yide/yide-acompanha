import { describe, it, expect } from "vitest";
import { updateLeadSchema } from "@/lib/gerador-leads/schema";

const validUuid = "00000000-0000-0000-0000-000000000000";

describe("updateLeadSchema — novos campos", () => {
  it("aceita cnpj como string", () => {
    const r = updateLeadSchema.safeParse({ id: validUuid, cnpj: "12345678000190" });
    expect(r.success).toBe(true);
  });

  it("aceita cnpj null", () => {
    const r = updateLeadSchema.safeParse({ id: validUuid, cnpj: null });
    expect(r.success).toBe(true);
  });

  it("rejeita cnpj muito longo", () => {
    const r = updateLeadSchema.safeParse({ id: validUuid, cnpj: "x".repeat(50) });
    expect(r.success).toBe(false);
  });

  it("aceita decisor_whatsapp como string", () => {
    const r = updateLeadSchema.safeParse({ id: validUuid, decisor_whatsapp: "+5565999999999" });
    expect(r.success).toBe(true);
  });

  it("aceita decisor_instagram como string", () => {
    const r = updateLeadSchema.safeParse({ id: validUuid, decisor_instagram: "joaosilva_oficial" });
    expect(r.success).toBe(true);
  });

  it("rejeita decisor_instagram muito longo", () => {
    const r = updateLeadSchema.safeParse({ id: validUuid, decisor_instagram: "x".repeat(100) });
    expect(r.success).toBe(false);
  });
});
