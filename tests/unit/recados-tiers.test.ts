import { describe, it, expect } from "vitest";
import { roleToTier, groupByTier, TIER_ORDER, type RecadoForTier } from "@/lib/recados/tiers";

describe("roleToTier", () => {
  it("classifica socio como socios", () => {
    expect(roleToTier("socio")).toBe("socios");
  });

  it("classifica coordenador como coordenadores", () => {
    expect(roleToTier("coordenador")).toBe("coordenadores");
  });

  it("classifica assessor como assessores", () => {
    expect(roleToTier("assessor")).toBe("assessores");
  });

  it("classifica adm como geral", () => {
    expect(roleToTier("adm")).toBe("geral");
  });

  it("classifica comercial como geral", () => {
    expect(roleToTier("comercial")).toBe("geral");
  });

  it("classifica audiovisuais como geral", () => {
    for (const r of ["videomaker", "designer", "editor", "audiovisual_chefe"]) {
      expect(roleToTier(r)).toBe("geral");
    }
  });

  it("classifica papel desconhecido como geral", () => {
    expect(roleToTier("papel_inventado")).toBe("geral");
  });
});

describe("groupByTier", () => {
  const r = (id: string, autor_role_snapshot: string, permanente = false): RecadoForTier => ({
    id,
    autor_role_snapshot,
    permanente,
  });

  it("separa fixados dos tiers normais", () => {
    const grupos = groupByTier([
      r("a", "socio", true),
      r("b", "coordenador"),
    ]);
    expect(grupos.fixados.map((x) => x.id)).toEqual(["a"]);
    expect(grupos.coordenadores.map((x) => x.id)).toEqual(["b"]);
    expect(grupos.socios.length).toBe(0);
  });

  it("agrupa por tier", () => {
    const grupos = groupByTier([
      r("1", "socio"),
      r("2", "coordenador"),
      r("3", "assessor"),
      r("4", "adm"),
      r("5", "designer"),
    ]);
    expect(grupos.socios.map((x) => x.id)).toEqual(["1"]);
    expect(grupos.coordenadores.map((x) => x.id)).toEqual(["2"]);
    expect(grupos.assessores.map((x) => x.id)).toEqual(["3"]);
    expect(grupos.geral.map((x) => x.id)).toEqual(["4", "5"]);
  });

  it("preserva ordem dentro do tier (input ordenado por data desc)", () => {
    const grupos = groupByTier([
      r("recente", "socio"),
      r("antigo", "socio"),
    ]);
    expect(grupos.socios.map((x) => x.id)).toEqual(["recente", "antigo"]);
  });
});

describe("TIER_ORDER", () => {
  it("ordem é socios → coordenadores → assessores → geral", () => {
    expect(TIER_ORDER).toEqual(["socios", "coordenadores", "assessores", "geral"]);
  });
});
