// tests/unit/freelayide-tipos.test.ts
import { describe, it, expect } from "vitest";
import { TIPO_OP, TIPO_OP_DEFS } from "@/lib/freela-yide/tipos";
import { criarOportunidadeSchema } from "@/lib/freela-yide/schema";

describe("tipo Edição", () => {
  it("edicao está em TIPO_OP", () => {
    expect(TIPO_OP).toContain("edicao");
  });
  it("edicao tem label e cor", () => {
    expect(TIPO_OP_DEFS.edicao.label).toBe("Edição");
    expect(TIPO_OP_DEFS.edicao.color).toMatch(/orange/);
  });
  it("schema aceita tipo edicao", () => {
    const r = criarOportunidadeSchema.safeParse({ titulo: "Edição reels", valor_comissao: 100, tipo: "edicao" });
    expect(r.success).toBe(true);
  });
});
