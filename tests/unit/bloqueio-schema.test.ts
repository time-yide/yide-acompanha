import { describe, it, expect } from "vitest";
import { createBloqueioSchema, rejeitarBloqueioSchema } from "@/lib/audiovisual/bloqueios/schema";

describe("createBloqueioSchema", () => {
  it("aceita bloqueio válido", () => {
    const r = createBloqueioSchema.safeParse({
      data: "2026-07-10", hora_inicio: "14:00", hora_fim: "15:00", motivo: "Consulta médica",
    });
    expect(r.success).toBe(true);
  });
  it("rejeita hora_fim <= hora_inicio", () => {
    const r = createBloqueioSchema.safeParse({
      data: "2026-07-10", hora_inicio: "15:00", hora_fim: "14:00", motivo: "x",
    });
    expect(r.success).toBe(false);
  });
  it("rejeita motivo vazio", () => {
    const r = createBloqueioSchema.safeParse({
      data: "2026-07-10", hora_inicio: "14:00", hora_fim: "15:00", motivo: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("rejeitarBloqueioSchema", () => {
  it("exige motivo_recusa", () => {
    const r = rejeitarBloqueioSchema.safeParse({ id: "11111111-1111-1111-1111-111111111111", motivo_recusa: "" });
    expect(r.success).toBe(false);
  });
});
