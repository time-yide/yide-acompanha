import { describe, it, expect } from "vitest";
import { normalizarUsername, validarUsername } from "./username";

describe("normalizarUsername", () => {
  it("lower + trim + tira @", () => {
    expect(normalizarUsername("  @Yasmin_M ")).toBe("yasmin_m");
  });
});

describe("validarUsername", () => {
  it("aceita 3-20 de letras/números/._", () => {
    expect(validarUsername("yasmin_m")).toBeNull();
    expect(validarUsername("duxx.99")).toBeNull();
  });
  it("rejeita curto demais", () => {
    expect(validarUsername("ab")).toMatch(/3/);
  });
  it("rejeita caractere inválido", () => {
    expect(validarUsername("yas min")).toMatch(/letras/);
  });
  it("rejeita vazio", () => {
    expect(validarUsername("")).toMatch(/3/);
  });
});
