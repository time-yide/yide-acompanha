import { describe, it, expect } from "vitest";
import { canAccess, type Action } from "@/lib/auth/permissions";

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
    expect(canAccess("invalid" as any, "manage:users")).toBe(false);
  });
});
