import { describe, expect, it } from "vitest";
import {
  handleInstagram, tokens, similaridade, rotuloDominio, sugerirParaCliente, sugerirConexoes, idsUsados,
  type ClienteConexao, type FontesConexao,
} from "./matching";

const cli = (over: Partial<ClienteConexao> = {}): ClienteConexao => ({
  id: "c1", nome: "Cliente", instagram_url: null, instagram_business_id: null, facebook_page_id: null,
  meta_ad_account_id: null, ga4_property_id: null, gsc_site_url: null, crm_tipo: null, crm_identifier: null, ...over,
});
const fontesVazias: FontesConexao = { paginas: [], contas: [], ga4: [], gsc: [], lyide: [] };
const fontes = (over: Partial<FontesConexao>): FontesConexao => ({ ...fontesVazias, ...over });

describe("handleInstagram", () => {
  it("extrai de URL com query e barra", () => {
    expect(handleInstagram("https://www.instagram.com/foo_bar/?hl=pt")).toBe("foo_bar");
    expect(handleInstagram("instagram.com/Foo.Bar")).toBe("foo.bar");
  });
  it("aceita @handle e handle puro", () => {
    expect(handleInstagram("@Foo")).toBe("foo");
    expect(handleInstagram("foo")).toBe("foo");
  });
  it("vazio, link de post ou outro site → null", () => {
    expect(handleInstagram(null)).toBeNull();
    expect(handleInstagram("  ")).toBeNull();
    expect(handleInstagram("https://www.instagram.com/p/abc123/")).toBeNull();
    expect(handleInstagram("https://facebook.com/foo")).toBeNull();
  });
});

describe("tokens", () => {
  it("tira acento, ruído e palavras de 1 letra", () => {
    expect(tokens("Loja Oficial da Pet Market Cuiabá LTDA")).toEqual(["pet", "market"]);
    expect(tokens("Gudu's Burger")).toEqual(["gudu", "burger"]);
    expect(tokens("Clínica dos Olhos MT")).toEqual(["clinica", "olhos"]);
  });
});

describe("similaridade", () => {
  it("nome igual = 1", () => {
    expect(similaridade("Nazca Sushi", "Nazca Sushi")).toBe(1);
    expect(similaridade("Atena", "ATENA")).toBe(1);
  });
  it("Atena casa com Atena RH Carreiras", () => {
    expect(similaridade("Atena", "Atena RH Carreiras")).toBeGreaterThanOrEqual(0.75);
  });
  it("Clinica dos olhos casa com Clinica Saúde dos Olhos MT", () => {
    expect(similaridade("Clinica dos olhos", "Clinica Saúde dos Olhos MT")).toBeGreaterThanOrEqual(0.75);
  });
  it("Pet Market casa com Petmarket Cuiabá (colado), mas não é certeza", () => {
    const s = similaridade("Pet Market", "Petmarket Cuiabá");
    expect(s).toBeGreaterThanOrEqual(0.75);
    expect(s).toBeLessThan(1);
  });
  it("Kaipo vs KaipoKesandrolls é no máximo médio", () => {
    const s = similaridade("Kaipo", "KaipoKesandrolls");
    expect(s).toBeGreaterThanOrEqual(0.75);
    expect(s).toBeLessThan(1);
  });
  it("nomes sem relação não casam", () => {
    expect(similaridade("Ludi Bolos", "Gudu's Burger")).toBeLessThan(0.75);
    expect(similaridade("Bella", "Isabella Doces")).toBeLessThan(0.75);
  });
});

describe("rotuloDominio", () => {
  it("tira esquema, sc-domain, www e TLD", () => {
    expect(rotuloDominio("https://www.petmarket.com.br/")).toBe("petmarket");
    expect(rotuloDominio("sc-domain:nazca-sushi.com")).toBe("nazcasushi");
  });
});

describe("sugerirParaCliente", () => {
  it("@ do Instagram igual → ALTA pro Instagram e pro Facebook", () => {
    const s = sugerirParaCliente(
      cli({ nome: "Qualquer", instagram_url: "https://instagram.com/atena.rh" }),
      fontes({ paginas: [{ pageId: "111", nome: "Página X", igId: "999", igUsername: "atena.rh" }] }),
    );
    expect(s).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: "instagram_business_id", valor: "999", confianca: "alta" }),
      expect.objectContaining({ campo: "facebook_page_id", valor: "111", confianca: "alta" }),
    ]));
  });
  it("página por nome parecido → MEDIA", () => {
    const s = sugerirParaCliente(cli({ nome: "Atena" }), fontes({ paginas: [{ pageId: "111", nome: "Atena RH Carreiras", igId: "999", igUsername: "atenarh" }] }));
    expect(s.find((x) => x.campo === "facebook_page_id")?.confianca).toBe("media");
    expect(s.find((x) => x.campo === "instagram_business_id")?.confianca).toBe("media");
  });
  it("conta de anúncio com mesmo nome → ALTA", () => {
    const s = sugerirParaCliente(cli({ nome: "Atena" }), fontes({ contas: [{ id: "act_1", nome: "Atena", empresa: null }] }));
    expect(s).toEqual([expect.objectContaining({ campo: "meta_ad_account_id", valor: "act_1", confianca: "alta" })]);
  });
  it("Nazca Sushi: Lyide e domínio exatos → ALTA", () => {
    const s = sugerirParaCliente(cli({ nome: "Nazca Sushi" }), fontes({
      lyide: [{ slug: "nazca", name: "Nazca Sushi" }],
      gsc: ["sc-domain:nazcasushi.com.br", "https://outro.com.br/"],
    }));
    expect(s.find((x) => x.campo === "crm_identifier")).toMatchObject({ valor: "nazca", confianca: "alta" });
    expect(s.find((x) => x.campo === "gsc_site_url")).toMatchObject({ valor: "sc-domain:nazcasushi.com.br", confianca: "alta" });
  });
  it("Kaipo vs conta KaipoKesandrolls → só MEDIA", () => {
    const s = sugerirParaCliente(cli({ nome: "Kaipo" }), fontes({ contas: [{ id: "act_2", nome: "KaipoKesandrolls", empresa: null }] }));
    expect(s[0]?.confianca).toBe("media");
  });
  it("nunca sobrescreve campo preenchido", () => {
    const s = sugerirParaCliente(
      cli({ nome: "Atena", meta_ad_account_id: "act_9", facebook_page_id: "5", instagram_business_id: "6", crm_tipo: "yide", crm_identifier: "x" }),
      fontes({ contas: [{ id: "act_1", nome: "Atena", empresa: null }], paginas: [{ pageId: "111", nome: "Atena", igId: "999", igUsername: "atena" }], lyide: [{ slug: "atena", name: "Atena" }] }),
    );
    expect(s).toEqual([]);
  });
  it("não sugere Lyide quando o cliente usa outro CRM", () => {
    expect(sugerirParaCliente(cli({ nome: "Atena", crm_tipo: "rdstation" }), fontes({ lyide: [{ slug: "atena", name: "Atena" }] }))).toEqual([]);
    expect(sugerirParaCliente(cli({ nome: "Atena", crm_tipo: "nenhum" }), fontes({ lyide: [{ slug: "atena", name: "Atena" }] }))).toEqual([]);
  });
  it("nomes sem relação → nada", () => {
    expect(sugerirParaCliente(cli({ nome: "Ludi Bolos" }), fontes({ contas: [{ id: "act_3", nome: "Gudu's Burger", empresa: null }] }))).toEqual([]);
  });
});

describe("sugerirConexoes (unicidade)", () => {
  const contas = [{ id: "act_1", nome: "Atena RH", empresa: null }];
  it("empate entre dois clientes → ninguém recebe", () => {
    const r = sugerirConexoes([cli({ id: "a", nome: "Atena Rh" }), cli({ id: "b", nome: "Atena RH" })], fontes({ contas }), new Set());
    expect(r).toEqual([]);
  });
  it("fica com quem tem maior pontuação", () => {
    const r = sugerirConexoes([cli({ id: "a", nome: "Atena" }), cli({ id: "b", nome: "Atena RH" })], fontes({ contas }), new Set());
    expect(r).toHaveLength(1);
    expect(r[0].clientId).toBe("b");
  });
  it("pula conta já usada por outro cliente (com ou sem act_)", () => {
    const usados = idsUsados([cli({ id: "z", meta_ad_account_id: "1" })]);
    expect(sugerirConexoes([cli({ id: "b", nome: "Atena RH" })], fontes({ contas }), usados)).toEqual([]);
  });
});
