import { describe, it, expect } from "vitest";
import { WHATSAPP_SITE, whatsappComTexto, ehLinkWhatsApp } from "@/lib/site/contato";

describe("contato do site", () => {
  it("link padrão passa pelo CRM (atribui a origem)", () => {
    expect(WHATSAPP_SITE).toBe("https://www.lyide.com.br/c/yide-geral");
  });
  it("mensagem montada vai para o número com 9 dígitos e leva a marcação da Yide", () => {
    const url = new URL(whatsappComTexto("Olá! Quero um diagnóstico.\nEmpresa: Kai"));
    expect(url.origin + url.pathname).toBe("https://wa.me/5565993063452");
    expect(url.searchParams.get("text")).toBe("Olá! Quero um diagnóstico.\nEmpresa: Kai\n[#yide-geral]");
  });
  it("reconhece links de WhatsApp (CRM e wa.me)", () => {
    expect(ehLinkWhatsApp("https://www.lyide.com.br/c/yide-geral")).toBe(true);
    expect(ehLinkWhatsApp("https://wa.me/5565993063452?text=oi")).toBe(true);
    expect(ehLinkWhatsApp("https://yidedigital.com.br/servicos")).toBe(false);
    expect(ehLinkWhatsApp(null)).toBe(false);
  });
});
