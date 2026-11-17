import { describe, it, expect } from "vitest";
import { CONTEUDO_SERVICOS, conteudoDoServico } from "@/lib/site/servicos-conteudo";
import { SEED_SERVICOS } from "@/lib/seo/config";

describe("conteúdo dos serviços", () => {
  it("existe conteúdo para cada serviço do seed", () => {
    for (const s of SEED_SERVICOS) expect(conteudoDoServico(s.slug), s.slug).not.toBeNull();
  });
  it("cada serviço tem resposta direta, entregas, etapas e FAQ suficientes", () => {
    for (const c of CONTEUDO_SERVICOS) {
      expect(c.resposta.length, c.slug).toBeGreaterThan(120);
      expect(c.entregas.length, c.slug).toBeGreaterThanOrEqual(5);
      expect(c.etapas.length, c.slug).toBe(4);
      expect(c.faq.length, c.slug).toBeGreaterThanOrEqual(3);
    }
  });
  it("meta title até 65 caracteres e meta description até 160", () => {
    for (const c of CONTEUDO_SERVICOS) {
      expect(c.metaTitulo.length, c.slug).toBeLessThanOrEqual(65);
      expect(c.metaDescricao.length, c.slug).toBeLessThanOrEqual(160);
    }
  });
  it("sem travessão no texto", () => {
    expect(JSON.stringify(CONTEUDO_SERVICOS)).not.toMatch(/[—–]/);
  });
});
