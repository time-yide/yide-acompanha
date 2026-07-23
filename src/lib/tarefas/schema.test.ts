import { describe, it, expect } from "vitest";
import { concludeOperationalSchema } from "./schema";

const base = { id: "11111111-1111-4111-8111-111111111111", to_status: "concluida", artes_entregues: 2 };

describe("concludeOperationalSchema", () => {
  it("aceita sem drive_link (caminho de vídeo)", () => {
    const r = concludeOperationalSchema.safeParse({ ...base });
    expect(r.success).toBe(true);
  });
  it("aceita com drive_link válido", () => {
    const r = concludeOperationalSchema.safeParse({ ...base, drive_link: "https://drive.google.com/x" });
    expect(r.success).toBe(true);
  });
  it("rejeita drive_link não-url quando presente", () => {
    const r = concludeOperationalSchema.safeParse({ ...base, drive_link: "nao-e-url" });
    expect(r.success).toBe(false);
  });
  it("exige artes_entregues >= 1", () => {
    const r = concludeOperationalSchema.safeParse({ ...base, artes_entregues: 0 });
    expect(r.success).toBe(false);
  });
});
