import { describe, it, expect } from "vitest";
import { isPacoteElegivel, PACOTES_ELEGIVEIS } from "@/lib/instagram-snapshots/tipos";

describe("isPacoteElegivel", () => {
  it("aceita yide_360, estrategia, trafego_estrategia", () => {
    for (const p of PACOTES_ELEGIVEIS) {
      expect(isPacoteElegivel(p)).toBe(true);
    }
  });

  it("rejeita pacotes que não fazem postagem orgânica", () => {
    for (const p of ["trafego", "audiovisual", "site", "ia", "crm", "crm_ia"]) {
      expect(isPacoteElegivel(p)).toBe(false);
    }
  });

  it("rejeita null e undefined", () => {
    expect(isPacoteElegivel(null)).toBe(false);
    expect(isPacoteElegivel(undefined)).toBe(false);
  });

  it("rejeita string aleatória", () => {
    expect(isPacoteElegivel("foobar")).toBe(false);
  });
});
