import { describe, it, expect } from "vitest";
import { requerGravacao, clienteObrigatorio } from "./reuniao-gravacao";

describe("requerGravacao", () => {
  it("true pra assessores/coordenadores/comercial quando manual", () => {
    for (const s of ["assessores", "coordenadores", "comercial"]) {
      expect(requerGravacao(s, "manual")).toBe(true);
    }
  });
  it("false pra agência/onboarding/programacao/videomakers", () => {
    for (const s of ["agencia", "onboarding", "programacao", "videomakers"]) {
      expect(requerGravacao(s, "manual")).toBe(false);
    }
  });
  it("false quando origem não é manual", () => {
    expect(requerGravacao("assessores", "lead_prospeccao")).toBe(false);
  });
});

describe("clienteObrigatorio", () => {
  it("true pra assessores e coordenadores", () => {
    expect(clienteObrigatorio("assessores")).toBe(true);
    expect(clienteObrigatorio("coordenadores")).toBe(true);
  });
  it("false pra comercial (reunião sem cliente)", () => {
    expect(clienteObrigatorio("comercial")).toBe(false);
  });
  it("false pra agência", () => {
    expect(clienteObrigatorio("agencia")).toBe(false);
  });
});
