import { describe, it, expect } from "vitest";
import { criarJobSchema, salvarPlanoSchema } from "@/lib/editor-ia/schema";
import { canUseEditorIa } from "@/lib/editor-ia/feature-flag";

describe("criarJobSchema", () => {
  it("aceita instrução + duração", () => {
    expect(criarJobSchema.safeParse({ instrucao: "corta os silêncios e legenda", video_duracao_segundos: 90 }).success).toBe(true);
  });
  it("rejeita instrução curta", () => {
    expect(criarJobSchema.safeParse({ instrucao: "x", video_duracao_segundos: 90 }).success).toBe(false);
  });
});

describe("salvarPlanoSchema", () => {
  it("aceita um EditPlan válido", () => {
    const r = salvarPlanoSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      edit_plan: { segments: [{ start: 0, end: 5, keep: true }], captions: [{ start: 0, end: 5, text: "oi" }] },
    });
    expect(r.success).toBe(true);
  });
  it("rejeita segmento sem end", () => {
    const r = salvarPlanoSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      edit_plan: { segments: [{ start: 0, keep: true }], captions: [] },
    });
    expect(r.success).toBe(false);
  });
});

describe("canUseEditorIa", () => {
  it("permite papéis de audiovisual/gestão", () => {
    expect(canUseEditorIa("editor")).toBe(true);
    expect(canUseEditorIa("adm")).toBe(true);
  });
  it("nega papel não-autorizado", () => {
    expect(canUseEditorIa("comercial")).toBe(false);
  });
});
