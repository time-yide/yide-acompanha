import { describe, it, expect } from "vitest";
import { regrasRobots } from "@/lib/site/robots";

describe("regrasRobots", () => {
  it("host do sistema bloqueia tudo", () => {
    const r = regrasRobots("sistemaacompanha.yidedigital.com.br", "https://yidedigital.com.br");
    expect(r.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
    expect(r.sitemap).toBeUndefined();
  });
  it("host público bloqueia as áreas internas", () => {
    const r = regrasRobots("yidedigital.com.br", "https://yidedigital.com.br");
    const geral = r.rules.find((x) => x.userAgent === "*")!;
    for (const p of ["/clientes", "/cliente", "/login", "/api", "/auth", "/programacao"]) {
      expect(geral.disallow).toContain(p);
    }
    expect(r.sitemap).toBe("https://yidedigital.com.br/sitemap.xml");
  });
  it("libera explicitamente os robôs de busca e de IA", () => {
    const r = regrasRobots("yidedigital.com.br", "https://yidedigital.com.br");
    const agentes = r.rules.map((x) => x.userAgent);
    for (const a of ["Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Google-Extended"]) {
      expect(agentes).toContain(a);
    }
  });
});
