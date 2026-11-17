import { describe, expect, it } from "vitest";
import { limparUrl } from "@/components/site/ContadorVisitas";

describe("limparUrl", () => {
  it("mantém só os parâmetros UTM", () => {
    expect(limparUrl("https://yidedigital.com.br/?utm_source=instagram&gclid=abc&email=a@b.com#topo"))
      .toBe("https://yidedigital.com.br/?utm_source=instagram");
  });
  it("devolve a URL sem parâmetros quando não há UTM", () => {
    expect(limparUrl("https://yidedigital.com.br/blog/x?fbclid=1")).toBe("https://yidedigital.com.br/blog/x");
  });
});
