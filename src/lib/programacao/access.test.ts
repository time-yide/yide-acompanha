import { describe, it, expect } from "vitest";
import { canAccessProgramacao } from "./access";

describe("canAccessProgramacao", () => {
  it("adm/socio/programacao entram", () => {
    expect(canAccessProgramacao("adm")).toBe(true);
    expect(canAccessProgramacao("socio")).toBe(true);
    expect(canAccessProgramacao("programacao")).toBe(true);
  });
  it("outros cargos não entram", () => {
    expect(canAccessProgramacao("assessor")).toBe(false);
    expect(canAccessProgramacao("videomaker")).toBe(false);
    expect(canAccessProgramacao("coordenador")).toBe(false);
  });
});
