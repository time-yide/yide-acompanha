import { describe, it, expect } from "vitest";
import { createEventSchema } from "./schema";

const base = {
  titulo: "Reunião X",
  inicio: "2026-07-25T14:00",
  fim: "2026-07-25T15:00",
  participantes_ids: [],
};

describe("createEventSchema — cliente obrigatório", () => {
  it("rejeita assessores sem cliente", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "assessores" });
    expect(r.success).toBe(false);
  });
  it("aceita assessores com cliente", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "assessores", client_id: "11111111-1111-4111-8111-111111111111" });
    expect(r.success).toBe(true);
  });
  it("aceita comercial sem cliente", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "comercial" });
    expect(r.success).toBe(true);
  });
  it("aceita agência sem cliente", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "agencia" });
    expect(r.success).toBe(true);
  });
});
