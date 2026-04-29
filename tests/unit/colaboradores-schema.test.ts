import { describe, it, expect } from "vitest";
import { createColaboradorSchema, editColaboradorSchema, ROLES } from "@/lib/colaboradores/schema";

const VALID_UUID = "00000000-0000-0000-0000-000000000000";

describe("ROLES", () => {
  it("contém os 9 roles esperados", () => {
    expect(ROLES).toEqual([
      "adm", "socio", "comercial", "coordenador", "assessor",
      "videomaker", "designer", "editor", "audiovisual_chefe",
    ]);
  });
});

describe("createColaboradorSchema", () => {
  it("aceita videomaker válido", () => {
    const r = createColaboradorSchema.safeParse({
      nome: "João",
      email: "joao@yide.com",
      role: "videomaker",
      fixo_mensal: 3000,
      comissao_percent: 0,
      comissao_primeiro_mes_percent: 0,
    });
    expect(r.success).toBe(true);
  });

  it("zera comissao_percent quando role é videomaker mesmo se enviar > 0", () => {
    const r = createColaboradorSchema.safeParse({
      nome: "João",
      email: "joao@yide.com",
      role: "videomaker",
      fixo_mensal: 3000,
      comissao_percent: 5,
      comissao_primeiro_mes_percent: 10,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.comissao_percent).toBe(0);
      expect(r.data.comissao_primeiro_mes_percent).toBe(0);
    }
  });

  it("zera comissao_percent quando role é designer", () => {
    const r = createColaboradorSchema.safeParse({
      nome: "Ana",
      email: "ana@yide.com",
      role: "designer",
      fixo_mensal: 2500,
      comissao_percent: 3,
      comissao_primeiro_mes_percent: 0,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.comissao_percent).toBe(0);
  });

  it("zera comissao_percent quando role é editor", () => {
    const r = createColaboradorSchema.safeParse({
      nome: "Bruno",
      email: "bruno@yide.com",
      role: "editor",
      fixo_mensal: 2200,
      comissao_percent: 2,
      comissao_primeiro_mes_percent: 0,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.comissao_percent).toBe(0);
  });

  it("preserva comissao_percent quando role é audiovisual_chefe", () => {
    const r = createColaboradorSchema.safeParse({
      nome: "Carla",
      email: "carla@yide.com",
      role: "audiovisual_chefe",
      fixo_mensal: 5000,
      comissao_percent: 2,
      comissao_primeiro_mes_percent: 0,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.comissao_percent).toBe(2);
  });

  it("preserva comissao_percent quando role é coordenador", () => {
    const r = createColaboradorSchema.safeParse({
      nome: "Diego",
      email: "diego@yide.com",
      role: "coordenador",
      fixo_mensal: 4500,
      comissao_percent: 3,
      comissao_primeiro_mes_percent: 0,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.comissao_percent).toBe(3);
  });

  it("rejeita role inválido", () => {
    const r = createColaboradorSchema.safeParse({
      nome: "Eva",
      email: "eva@yide.com",
      role: "fotografo",
      fixo_mensal: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita email mal-formado", () => {
    const r = createColaboradorSchema.safeParse({
      nome: "Felipe",
      email: "nao-eh-email",
      role: "assessor",
      fixo_mensal: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita nome com 1 char", () => {
    const r = createColaboradorSchema.safeParse({
      nome: "G",
      email: "g@yide.com",
      role: "assessor",
      fixo_mensal: 0,
    });
    expect(r.success).toBe(false);
  });
});

describe("editColaboradorSchema", () => {
  it("zera comissao_percent quando role muda para videomaker", () => {
    const r = editColaboradorSchema.safeParse({
      id: VALID_UUID,
      nome: "Helena",
      role: "videomaker",
      fixo_mensal: 3000,
      comissao_percent: 5,
      comissao_primeiro_mes_percent: 0,
      ativo: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.comissao_percent).toBe(0);
      expect(r.data.comissao_primeiro_mes_percent).toBe(0);
    }
  });

  it("preserva comissao_percent quando role é audiovisual_chefe", () => {
    const r = editColaboradorSchema.safeParse({
      id: VALID_UUID,
      nome: "Ivo",
      role: "audiovisual_chefe",
      fixo_mensal: 5000,
      comissao_percent: 2,
      comissao_primeiro_mes_percent: 0,
      ativo: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.comissao_percent).toBe(2);
  });
});
