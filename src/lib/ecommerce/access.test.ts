import { describe, it, expect } from "vitest";
import { canAccessEcommerce } from "./access";

describe("canAccessEcommerce", () => {
  it("cargos dedicados de e-commerce entram", () => {
    expect(canAccessEcommerce("assessor_ecommerce")).toBe(true);
    expect(canAccessEcommerce("assistente_ecommerce")).toBe(true);
    expect(canAccessEcommerce("adm")).toBe(true);
    expect(canAccessEcommerce("socio")).toBe(true);
  });
  it("assessor comum entra só com especialidade ecommerce (caso Felipe)", () => {
    expect(canAccessEcommerce("assessor", "ecommerce")).toBe(true);
    expect(canAccessEcommerce("assessor", null)).toBe(false);
    expect(canAccessEcommerce("assessor")).toBe(false);
  });
  it("outros cargos não entram", () => {
    expect(canAccessEcommerce("videomaker")).toBe(false);
  });
});
