import { describe, it, expect } from "vitest";
import { progressoChecklist, parsePostPresenca, montarPromptPresenca } from "@/lib/presenca/core";
import { CHECKLIST_GMN } from "@/lib/presenca/config";

describe("progressoChecklist", () => {
  it("calcula feitos/total/pct", () => {
    const r = progressoChecklist(CHECKLIST_GMN, ["categoria", "site", "inexistente"]);
    expect(r.total).toBe(CHECKLIST_GMN.length);
    expect(r.feitos).toBe(2); // ignora key inexistente
    expect(r.pct).toBe(Math.round((2 / CHECKLIST_GMN.length) * 100));
  });
  it("lista vazia = 0%", () => {
    expect(progressoChecklist(CHECKLIST_GMN, []).pct).toBe(0);
  });
});

describe("parsePostPresenca", () => {
  it("sanitiza travessão e limita hashtags", () => {
    const r = parsePostPresenca({ conteudo: "post — aqui", hashtags: ["#a", "#b", 1, "#c", "#d", "#e", "#f"] });
    expect(r).not.toBeNull();
    expect(r!.conteudo.includes("—")).toBe(false);
    expect(r!.hashtags.length).toBeLessThanOrEqual(5);
  });
  it("null sem conteúdo", () => {
    expect(parsePostPresenca({ conteudo: "" })).toBeNull();
    expect(parsePostPresenca(null)).toBeNull();
  });
});

describe("montarPromptPresenca", () => {
  it("GMN pede post curto; LinkedIn pede hashtags", () => {
    expect(montarPromptPresenca("gmn", "promoção", ["marketing em Cuiabá"])).toContain("Google Meu Negócio");
    expect(montarPromptPresenca("linkedin", "", ["marketing em Cuiabá"])).toContain("LinkedIn");
  });
  it("cobre os 9 canais com o nome e o formato de JSON certo", () => {
    const canais = ["gmn", "linkedin", "instagram", "tiktok", "youtube", "threads", "facebook", "pinterest", "medium"] as const;
    for (const c of canais) {
      const p = montarPromptPresenca(c, "tema", ["marketing em Cuiabá"]);
      expect(p).toContain("SOMENTE com JSON");
      expect(p).toContain("NUNCA use travessão");
    }
    // canais sem hashtags devem trazer array vazio no exemplo de JSON
    expect(montarPromptPresenca("gmn", "", [])).toContain(`"hashtags": []`);
    expect(montarPromptPresenca("pinterest", "", [])).toContain(`"hashtags": []`);
    // canais com hashtags devem trazer exemplo com #
    expect(montarPromptPresenca("instagram", "", [])).toContain(`"hashtags": ["#exemplo"]`);
  });
});
