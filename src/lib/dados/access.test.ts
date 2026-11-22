import { describe, expect, it } from "vitest";
import { canAccessDados, dadosVeTodos, podeEditarConexoes } from "./access";

describe("dados/access", () => {
  it("quem acessa", () => {
    for (const r of ["adm", "socio", "programacao", "assessor"]) expect(canAccessDados(r)).toBe(true);
    for (const r of ["comercial", "videomaker", "designer", "coordenador"]) expect(canAccessDados(r)).toBe(false);
  });
  it("quem vê todos", () => {
    expect(dadosVeTodos("adm")).toBe(true);
    expect(dadosVeTodos("programacao")).toBe(true);
    expect(dadosVeTodos("assessor")).toBe(false);
  });
  it("quem edita conexões", () => {
    expect(podeEditarConexoes("socio")).toBe(true);
    expect(podeEditarConexoes("assessor")).toBe(false);
  });
});
