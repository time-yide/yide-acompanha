import { describe, it, expect } from "vitest";
import { lerTags } from "@/lib/site/tags";

describe("lerTags", () => {
  it("usa a conta Yide do Google Ads por padrão", () => {
    const t = lerTags({});
    expect(t.googleAdsId).toBe("AW-18562196515");
    expect(t.adsWhatsappSendTo).toBe("AW-18562196515/pEfDCJ7KkLQdEKPIkpNF");
    expect(t.ga4Id).toBeNull();
    expect(t.metaPixelId).toBeNull();
    expect(t.lyideCompanyId).toBeNull();
  });
  it("lê os IDs das variáveis de ambiente", () => {
    const t = lerTags({ NEXT_PUBLIC_GA4_ID: "G-ABC123", NEXT_PUBLIC_META_PIXEL_ID: "123", NEXT_PUBLIC_LYIDE_COMPANY_ID: "cmx" });
    expect(t.ga4Id).toBe("G-ABC123");
    expect(t.metaPixelId).toBe("123");
    expect(t.lyideCompanyId).toBe("cmx");
  });
  it("ignora valores em branco", () => {
    expect(lerTags({ NEXT_PUBLIC_GA4_ID: "  " }).ga4Id).toBeNull();
  });
});
