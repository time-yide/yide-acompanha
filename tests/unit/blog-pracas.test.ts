import { describe, expect, it } from "vitest";
import { CIDADES, CIDADES_BRASIL, PRACAS, escolherPraca, selecionarKeywordsAlvo } from "@/lib/blog/pipeline/keywords";
import { montarPromptEstrategico } from "@/lib/blog/pipeline/estrategico";

describe("praças do blog", () => {
  it("as praças com equipe presencial incluem Salvador e Vitória/Vila Velha", () => {
    expect(CIDADES).toEqual(expect.arrayContaining(["Cuiabá", "Salvador", "Vitória", "Vila Velha"]));
    expect(PRACAS.map((p) => p.nome).join(" ")).toMatch(/Salvador.*Vitória/);
  });
  it("escolherPraca cobre as três praças", () => {
    expect(escolherPraca(() => 0).nome).toContain("Cuiabá");
    expect(escolherPraca(() => 0.5).nome).toContain("Salvador");
    expect(escolherPraca(() => 0.99).nome).toContain("Vitória");
  });
  it("tema que cita a cidade usa a praça dela, sem sorteio", () => {
    expect(escolherPraca(() => 0.99, "Criação de loja virtual em Cuiabá: quanto custa?").nome).toContain("Cuiabá");
    expect(escolherPraca(() => 0, "Agência de marketing em Várzea Grande: o que avaliar?").nome).toContain("Cuiabá");
    expect(escolherPraca(() => 0, "Agência de marketing em Mato Grosso: como escolher?").nome).toContain("Cuiabá");
    expect(escolherPraca(() => 0, "Delivery em Salvador vende mais no Carnaval?").nome).toContain("Salvador");
    expect(escolherPraca(() => 0, "Loja em Vila Velha precisa de site?").nome).toContain("Vitória");
    expect(escolherPraca(() => 0.5, "Como vender mais em janeiro?").nome).toContain("Salvador");
  });
  it("às vezes entra uma cidade de fora das praças", () => {
    const ks = selecionarKeywordsAlvo(4, () => 0.1);
    expect(CIDADES_BRASIL.some((c) => ks.some((k) => k.includes(c)))).toBe(true);
  });
  it("sem sorteio de fora, as keywords locais são só das praças", () => {
    const ks = selecionarKeywordsAlvo(4, () => 0.9).slice(0, 3);
    expect(ks.every((k) => CIDADES.some((c) => k.includes(c)))).toBe(true);
  });
  it("o prompt usa a praça escolhida", () => {
    const p = montarPromptEstrategico("Como vender mais?", [], PRACAS[1]);
    expect(p).toContain("Salvador (BA)");
    expect(p).toContain("equipe presencial em Cuiabá/Várzea Grande, Salvador e Vitória/Vila Velha");
  });
});
