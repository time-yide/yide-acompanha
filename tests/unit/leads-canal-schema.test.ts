import { describe, it, expect } from "vitest";
import { createLeadSchema } from "@/lib/leads/schema";
describe("createLeadSchema canal", () => {
  it("default ligacao quando ausente", () => {
    const r = createLeadSchema.safeParse({ nome_prospect: "Padaria X" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.canal).toBe("ligacao");
  });
  it("aceita rua", () => {
    const r = createLeadSchema.safeParse({ nome_prospect: "Padaria X", canal: "rua" });
    expect(r.success && r.data.canal).toBe("rua");
  });
  it("rejeita canal inválido", () => {
    expect(createLeadSchema.safeParse({ nome_prospect: "X", canal: "email" }).success).toBe(false);
  });
});
