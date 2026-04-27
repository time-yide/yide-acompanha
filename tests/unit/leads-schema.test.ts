import { describe, it, expect } from "vitest";
import { createLeadSchema, moveStageSchema, markLostSchema } from "@/lib/leads/schema";

describe("createLeadSchema", () => {
  it("aceita lead mínimo", () => {
    expect(createLeadSchema.safeParse({ nome_prospect: "Pizzaria Bella" }).success).toBe(true);
  });
  it("rejeita nome curto", () => {
    expect(createLeadSchema.safeParse({ nome_prospect: "A" }).success).toBe(false);
  });
  it("aceita site vazio", () => {
    expect(createLeadSchema.safeParse({ nome_prospect: "X cliente", site: "" }).success).toBe(true);
  });
  it("rejeita site malformado", () => {
    expect(createLeadSchema.safeParse({ nome_prospect: "X cliente", site: "abc" }).success).toBe(false);
  });
  it("default priority is media", () => {
    const r = createLeadSchema.safeParse({ nome_prospect: "X cliente" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prioridade).toBe("media");
  });
});

describe("moveStageSchema", () => {
  it("aceita stage válido", () => {
    expect(moveStageSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      to_stage: "comercial",
    }).success).toBe(true);
  });
  it("rejeita stage desconhecido", () => {
    expect(moveStageSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      to_stage: "ganhou_no_dado",
    }).success).toBe(false);
  });
});

describe("markLostSchema", () => {
  it("exige motivo", () => {
    expect(markLostSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      motivo_perdido: "ab",
    }).success).toBe(false);
  });
  it("aceita marcar perdido com motivo", () => {
    expect(markLostSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      motivo_perdido: "Cliente decidiu por outra agência",
    }).success).toBe(true);
  });
});
