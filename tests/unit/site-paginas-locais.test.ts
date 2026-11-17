import { describe, it, expect } from "vitest";
import { PAGINAS_LOCAIS, paginaLocal } from "@/lib/site/paginas-locais";
import { CIDADES } from "@/lib/site/cidades";
import { conteudoDoServico } from "@/lib/site/servicos-conteudo";

describe("páginas serviço × cidade", () => {
  it("cada página aponta para serviço e cidade existentes, sem repetir", () => {
    const chaves = new Set<string>();
    for (const p of PAGINAS_LOCAIS) {
      expect(conteudoDoServico(p.servico), p.servico).not.toBeNull();
      expect(CIDADES.some((c) => c.slug === p.cidade), p.cidade).toBe(true);
      const k = `${p.servico}/${p.cidade}`;
      expect(chaves.has(k), k).toBe(false);
      chaves.add(k);
    }
  });
  it("conteúdo próprio: resposta, 2 parágrafos de contexto, focos e FAQ", () => {
    for (const p of PAGINAS_LOCAIS) {
      const k = `${p.servico}/${p.cidade}`;
      expect(p.resposta.length, k).toBeGreaterThan(150);
      expect(p.contexto.length, k).toBeGreaterThanOrEqual(2);
      expect(p.focos.length, k).toBeGreaterThanOrEqual(4);
      expect(p.faq.length, k).toBeGreaterThanOrEqual(3);
    }
  });
  it("nada de texto copiado entre cidades (anti doorway)", () => {
    const textos = PAGINAS_LOCAIS.flatMap((p) => [p.resposta, ...p.contexto]);
    expect(new Set(textos).size).toBe(textos.length);
  });
  it("cita a cidade no título e na resposta", () => {
    for (const p of PAGINAS_LOCAIS) {
      const nome = CIDADES.find((c) => c.slug === p.cidade)!.nome;
      expect(p.titulo).toContain(nome);
      expect(p.resposta).toContain(nome);
    }
  });
  it("limites de meta e sem travessão", () => {
    for (const p of PAGINAS_LOCAIS) {
      expect(p.metaTitulo.length, p.metaTitulo).toBeLessThanOrEqual(65);
      expect(p.metaDescricao.length, p.metaDescricao).toBeLessThanOrEqual(160);
    }
    expect(JSON.stringify(PAGINAS_LOCAIS)).not.toMatch(/[—–]/);
  });
  it("busca por serviço e cidade", () => {
    expect(paginaLocal("gestao-de-trafego", "cuiaba")?.titulo).toBe("Gestão de tráfego pago em Cuiabá");
    expect(paginaLocal("gestao-de-trafego", "sinop")).toBeNull();
  });
});
