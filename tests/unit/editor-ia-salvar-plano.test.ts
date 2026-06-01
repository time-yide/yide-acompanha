import { describe, it, expect } from "vitest";
import { salvarPlanoSchema } from "@/lib/editor-ia/schema";

const ID = "11111111-1111-1111-1111-111111111111";
describe("salvarPlanoSchema (timeline)", () => {
  it("aceita plano editado", () => {
    const r = salvarPlanoSchema.safeParse({
      id: ID,
      edit_plan: { segments: [{ start: 0, end: 2, keep: true }, { start: 2, end: 5, keep: false }], captions: [{ start: 0, end: 2, text: "oi" }] },
    });
    expect(r.success).toBe(true);
  });
  it("rejeita keep não-booleano", () => {
    const r = salvarPlanoSchema.safeParse({
      id: ID, edit_plan: { segments: [{ start: 0, end: 2, keep: "sim" }], captions: [] },
    });
    expect(r.success).toBe(false);
  });
});
