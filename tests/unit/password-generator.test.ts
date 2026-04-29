import { describe, it, expect } from "vitest";
import { generateStrongPassword } from "@/lib/auth/password-generator";

const ALLOWED_ALPHABET_REGEX = /^[A-Za-z0-9!@#$%^&*\-_=+]+$/;
const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /[0-9]/;
const SYMBOL = /[!@#$%^&*\-_=+]/;

describe("generateStrongPassword", () => {
  it("retorna senha de 12 caracteres por padrão", () => {
    const pwd = generateStrongPassword();
    expect(pwd).toHaveLength(12);
  });

  it("respeita o tamanho customizado (16)", () => {
    const pwd = generateStrongPassword(16);
    expect(pwd).toHaveLength(16);
  });

  it("contém ao menos 1 maiúscula, 1 minúscula, 1 dígito e 1 símbolo (20 amostras)", () => {
    for (let i = 0; i < 20; i++) {
      const pwd = generateStrongPassword();
      expect(UPPER.test(pwd), `sem maiúscula em "${pwd}"`).toBe(true);
      expect(LOWER.test(pwd), `sem minúscula em "${pwd}"`).toBe(true);
      expect(DIGIT.test(pwd), `sem dígito em "${pwd}"`).toBe(true);
      expect(SYMBOL.test(pwd), `sem símbolo em "${pwd}"`).toBe(true);
    }
  });

  it("lança erro se o tamanho for menor que 8", () => {
    expect(() => generateStrongPassword(7)).toThrow();
    expect(() => generateStrongPassword(0)).toThrow();
    expect(() => generateStrongPassword(-1)).toThrow();
  });

  it("duas chamadas consecutivas produzem senhas diferentes", () => {
    const a = generateStrongPassword();
    const b = generateStrongPassword();
    expect(a).not.toBe(b);
  });

  it("usa apenas caracteres do alfabeto permitido (20 amostras)", () => {
    for (let i = 0; i < 20; i++) {
      const pwd = generateStrongPassword(20);
      expect(ALLOWED_ALPHABET_REGEX.test(pwd), `caractere inválido em "${pwd}"`).toBe(true);
    }
  });
});
