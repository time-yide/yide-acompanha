import { describe, it, expect } from "vitest";
import { nivelDeXP } from "@/lib/freela-yide/niveis";

describe("nivelDeXP", () => {
  it("xp 0 => Novato nv1, faltam 100 pra Promessa, pct 0", () => {
    const n = nivelDeXP(0);
    expect(n.nivel).toBe(1);
    expect(n.titulo).toBe("Novato");
    expect(n.xpProximo).toBe(100);
    expect(n.proximoTitulo).toBe("Promessa");
    expect(n.faltam).toBe(100);
    expect(n.pct).toBe(0);
  });
  it("xp 50 => Novato, pct 50, faltam 50", () => {
    const n = nivelDeXP(50);
    expect(n.nivel).toBe(1);
    expect(n.pct).toBe(50);
    expect(n.faltam).toBe(50);
  });
  it("xp 100 => Promessa nv2, base 100, próximo 300", () => {
    const n = nivelDeXP(100);
    expect(n.nivel).toBe(2);
    expect(n.titulo).toBe("Promessa");
    expect(n.xpBase).toBe(100);
    expect(n.xpProximo).toBe(300);
    expect(n.faltam).toBe(200);
  });
  it("borda: xp 699 ainda é Craque, xp 700 vira Fera", () => {
    expect(nivelDeXP(699).titulo).toBe("Craque");
    expect(nivelDeXP(699).nivel).toBe(3);
    expect(nivelDeXP(700).titulo).toBe("Fera");
    expect(nivelDeXP(700).nivel).toBe(4);
  });
  it("xp 3500 => Mito nv6, nível máximo", () => {
    const n = nivelDeXP(3500);
    expect(n.nivel).toBe(6);
    expect(n.titulo).toBe("Mito");
    expect(n.xpProximo).toBeNull();
    expect(n.proximoTitulo).toBeNull();
    expect(n.faltam).toBe(0);
    expect(n.pct).toBe(100);
  });
  it("xp negativo é tratado como 0 (Novato)", () => {
    const n = nivelDeXP(-20);
    expect(n.nivel).toBe(1);
    expect(n.xpAtual).toBe(0);
  });
});
