import { describe, it, expect } from "vitest";
import { canAccess, ROLE_LABELS, roleLabel, type Action } from "@/lib/auth/permissions";

describe("permissions.canAccess", () => {
  it("socio can do everything", () => {
    const all: Action[] = [
      "manage:users", "edit:commission_percent", "view:all_clients",
      "view:financial_consolidated", "approve:monthly_closing",
      "access:prospeccao", "edit:colaboradores",
    ];
    for (const action of all) {
      expect(canAccess("socio", action), action).toBe(true);
    }
  });

  it("adm cannot edit commission percent (only socio can)", () => {
    expect(canAccess("adm", "edit:commission_percent")).toBe(false);
  });

  it("adm can manage users", () => {
    expect(canAccess("adm", "manage:users")).toBe(true);
  });

  it("comercial can access prospeccao but not edit colaboradores", () => {
    expect(canAccess("comercial", "access:prospeccao")).toBe(true);
    expect(canAccess("comercial", "edit:colaboradores")).toBe(false);
  });

  it("coordenador and assessor cannot access prospeccao", () => {
    expect(canAccess("coordenador", "access:prospeccao")).toBe(false);
    expect(canAccess("assessor", "access:prospeccao")).toBe(false);
  });

  it("only socio can approve monthly closing", () => {
    expect(canAccess("socio", "approve:monthly_closing")).toBe(true);
    expect(canAccess("adm", "approve:monthly_closing")).toBe(false);
    expect(canAccess("coordenador", "approve:monthly_closing")).toBe(false);
  });

  it("returns false for unknown role/action combo", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(canAccess("invalid" as any, "manage:users")).toBe(false);
  });
});

describe("assessor_ecommerce role", () => {
  it("tem label visível", () => {
    expect(ROLE_LABELS.assessor_ecommerce).toBe("Assessor de e-commerce");
    expect(roleLabel("assessor_ecommerce")).toBe("Assessor de e-commerce");
  });
  it("não tem acesso a ações privilegiadas por padrão", () => {
    expect(canAccess("assessor_ecommerce", "manage:users")).toBe(false);
    expect(canAccess("assessor_ecommerce", "view:financial_consolidated")).toBe(false);
  });
  it("pode criar tarefas", () => {
    expect(canAccess("assessor_ecommerce", "create:tasks")).toBe(true);
  });
});

describe("assistente_ecommerce role", () => {
  it("tem label visível", () => {
    expect(ROLE_LABELS.assistente_ecommerce).toBe("Assistente de e-commerce");
    expect(roleLabel("assistente_ecommerce")).toBe("Assistente de e-commerce");
  });
  it("não tem acesso a ações privilegiadas por padrão", () => {
    expect(canAccess("assistente_ecommerce", "manage:users")).toBe(false);
    expect(canAccess("assistente_ecommerce", "view:financial_consolidated")).toBe(false);
  });
  it("pode criar tarefas (mesmos acessos do assessor de e-commerce)", () => {
    expect(canAccess("assistente_ecommerce", "create:tasks")).toBe(true);
  });
});

describe("programacao role", () => {
  it("tem label 'Programação'", () => {
    expect(ROLE_LABELS.programacao).toBe("Programação");
    expect(roleLabel("programacao")).toBe("Programação");
  });
  it("não tem acesso a nada por padrão", () => {
    expect(canAccess("programacao", "manage:users")).toBe(false);
    expect(canAccess("programacao", "create:tasks")).toBe(false);
    expect(canAccess("programacao", "view:all_clients")).toBe(false);
    expect(canAccess("programacao", "view:financial_consolidated")).toBe(false);
  });
});

describe("fast_midia role", () => {
  it("tem label 'Fast Mídia'", () => {
    expect(ROLE_LABELS.fast_midia).toBe("Fast Mídia");
    expect(roleLabel("fast_midia")).toBe("Fast Mídia");
  });
  it("não tem acessos especiais por padrão", () => {
    expect(canAccess("fast_midia", "manage:users")).toBe(false);
    expect(canAccess("fast_midia", "view:all_clients")).toBe(false);
  });
});

describe("rename ADM → Administrativo", () => {
  it("o role 'adm' agora tem label 'Administrativo'", () => {
    expect(ROLE_LABELS.adm).toBe("Administrativo");
    expect(roleLabel("adm")).toBe("Administrativo");
  });
});
