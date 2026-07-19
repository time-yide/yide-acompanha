import { describe, it, expect } from "vitest";
import { mergeHomeConfig, HOME_DEFAULTS } from "@/lib/seo/home-config";
describe("mergeHomeConfig", () => {
  it("row nula devolve defaults", () => {
    expect(mergeHomeConfig(null)).toEqual(HOME_DEFAULTS);
  });
  it("sobrepõe campos válidos e ignora stats malformados", () => {
    const r = mergeHomeConfig({ hero_titulo: "Oi", stats: [{ valor: "10", rotulo: "x" }, { valor: 1 }], clientes: ["A", 2] });
    expect(r.hero_titulo).toBe("Oi");
    expect(r.stats).toEqual([{ valor: "10", rotulo: "x" }]);
    expect(r.clientes).toEqual(["A"]);
  });
  it("string vazia no titulo cai no default", () => {
    expect(mergeHomeConfig({ hero_titulo: "" }).hero_titulo).toBe(HOME_DEFAULTS.hero_titulo);
  });
});
