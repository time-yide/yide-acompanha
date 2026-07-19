import { describe, it, expect } from "vitest";
import { montarPromptEstrategico, parseArtigoEstrategico } from "@/lib/blog/pipeline/estrategico";
import { slugDoTema, TEMAS_ESTRATEGICOS } from "@/lib/blog/pipeline/temas-estrategicos";

describe("montarPromptEstrategico", () => {
  const pergunta = "Como reduzir o custo por lead no Meta Ads?";

  it("é editor-chefe e inclui a própria pergunta", () => {
    const p = montarPromptEstrategico(pergunta, []);
    expect(p.toLowerCase()).toContain("editor");
    expect(p).toContain(pergunta);
  });

  it("proíbe travessão e cifras inventadas, e pede EEAT/GEO", () => {
    const p = montarPromptEstrategico(pergunta, []);
    expect(p).toContain("—"); // menciona o travessão pra proibir
    expect(p.toLowerCase()).toContain("travessão");
    expect(p.toLowerCase()).toContain("nunca");
  });

  it("inclui os links internos dos serviços da Yide", () => {
    const p = montarPromptEstrategico(pergunta, []);
    expect(p).toContain("/servicos/gestao-de-trafego");
    expect(p).toContain("/servicos/crm-ia-dados");
  });

  it("tece as keywords-alvo quando fornecidas", () => {
    const p = montarPromptEstrategico(pergunta, ["gestor de tráfego em Cuiabá"]);
    expect(p).toContain("gestor de tráfego em Cuiabá");
  });

  it("pede saída JSON com faq", () => {
    const p = montarPromptEstrategico(pergunta, []);
    expect(p).toContain("faq");
    expect(p.toLowerCase()).toContain("json");
  });
});

describe("parseArtigoEstrategico", () => {
  const base = {
    titulo: "Como reduzir o custo por lead no Meta Ads",
    resumo: "Um guia prático.",
    conteudo_md: "## Introdução\nTexto do artigo.",
    keywords: ["meta ads", "custo por lead"],
    meta_title: "Reduza o custo por lead no Meta Ads",
    meta_description: "Guia prático para reduzir o CPL.",
    faq: [{ pergunta: "O que é CPL?", resposta: "Custo por lead." }],
  };

  it("retorna artigo válido com faq tipada", () => {
    const a = parseArtigoEstrategico(base);
    expect(a).not.toBeNull();
    expect(a!.titulo).toBe(base.titulo);
    expect(a!.faq).toHaveLength(1);
    expect(a!.faq[0].pergunta).toBe("O que é CPL?");
  });

  it("sanitiza travessão em todos os campos", () => {
    const a = parseArtigoEstrategico({
      ...base,
      titulo: "Meta Ads — o guia",
      conteudo_md: "Texto — com travessão",
      faq: [{ pergunta: "P — dúvida", resposta: "R — resposta" }],
    });
    expect(a).not.toBeNull();
    expect(a!.titulo).not.toContain("—");
    expect(a!.conteudo_md).not.toContain("—");
    expect(a!.faq[0].pergunta).not.toContain("—");
    expect(a!.faq[0].resposta).not.toContain("—");
  });

  it("limita faq a 8 e descarta itens sem pergunta ou resposta", () => {
    const faq = Array.from({ length: 12 }, (_, i) => ({ pergunta: `P${i}`, resposta: `R${i}` }));
    faq.push({ pergunta: "", resposta: "sem pergunta" });
    const a = parseArtigoEstrategico({ ...base, faq });
    expect(a!.faq.length).toBeLessThanOrEqual(8);
    expect(a!.faq.every((f) => f.pergunta && f.resposta)).toBe(true);
  });

  it("limita keywords a 8", () => {
    const keywords = Array.from({ length: 12 }, (_, i) => `k${i}`);
    const a = parseArtigoEstrategico({ ...base, keywords });
    expect(a!.keywords.length).toBeLessThanOrEqual(8);
  });

  it("trunca meta_title (70) e meta_description (160)", () => {
    const a = parseArtigoEstrategico({
      ...base,
      meta_title: "x".repeat(120),
      meta_description: "y".repeat(300),
    });
    expect(a!.meta_title.length).toBeLessThanOrEqual(70);
    expect(a!.meta_description.length).toBeLessThanOrEqual(160);
  });

  it("retorna null sem titulo ou sem conteudo", () => {
    expect(parseArtigoEstrategico({ ...base, titulo: "" })).toBeNull();
    expect(parseArtigoEstrategico({ ...base, conteudo_md: "" })).toBeNull();
    expect(parseArtigoEstrategico(null)).toBeNull();
  });
});

describe("slugDoTema", () => {
  it("gera slug estável a partir da pergunta", () => {
    expect(slugDoTema("Como reduzir o custo por lead no Meta Ads?")).toBe(
      "como-reduzir-o-custo-por-lead-no-meta-ads",
    );
  });
  it("todos os temas têm slug único e não vazio", () => {
    const slugs = TEMAS_ESTRATEGICOS.map((t) => slugDoTema(t.pergunta));
    expect(slugs.every(Boolean)).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
