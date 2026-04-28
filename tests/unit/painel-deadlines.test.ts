import { describe, it, expect } from "vitest";
import { STEP_DEADLINES, isAtrasada, getDeadline } from "@/lib/painel/deadlines";

describe("STEP_DEADLINES", () => {
  it("tem 11 etapas com prazos", () => {
    expect(Object.keys(STEP_DEADLINES)).toHaveLength(11);
  });

  it("cronograma é dia 7", () => {
    expect(STEP_DEADLINES.cronograma).toBe(7);
  });

  it("postagem é dia 30", () => {
    expect(STEP_DEADLINES.postagem).toBe(30);
  });

  it("design/camera/mobile/edicao são dia 23", () => {
    expect(STEP_DEADLINES.design).toBe(23);
    expect(STEP_DEADLINES.camera).toBe(23);
    expect(STEP_DEADLINES.mobile).toBe(23);
    expect(STEP_DEADLINES.edicao).toBe(23);
  });
});

describe("getDeadline", () => {
  it("retorna prazo da etapa", () => {
    expect(getDeadline("cronograma")).toBe(7);
    expect(getDeadline("postagem")).toBe(30);
  });
});

describe("isAtrasada", () => {
  it("retorna false se status é pronto, mesmo passou do prazo", () => {
    const today = new Date(Date.UTC(2026, 4, 15));
    expect(isAtrasada("cronograma", "pronto", today)).toBe(false);
  });

  it("retorna true se hoje > prazo e status != pronto", () => {
    const today = new Date(Date.UTC(2026, 4, 15));
    expect(isAtrasada("cronograma", "pendente", today)).toBe(true);
    expect(isAtrasada("cronograma", "em_andamento", today)).toBe(true);
  });

  it("retorna false se hoje <= prazo", () => {
    const today = new Date(Date.UTC(2026, 4, 5));
    expect(isAtrasada("cronograma", "pendente", today)).toBe(false);
  });

  it("postagem prazo dia 30 — dia 30 ainda não é atrasada", () => {
    const today = new Date(Date.UTC(2026, 4, 30));
    expect(isAtrasada("postagem", "pendente", today)).toBe(false);
  });

  it("postagem prazo dia 30 — dia 31 é atrasada", () => {
    const today = new Date(Date.UTC(2026, 4, 31));
    expect(isAtrasada("postagem", "pendente", today)).toBe(true);
  });
});
