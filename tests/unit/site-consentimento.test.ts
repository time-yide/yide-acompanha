import { describe, it, expect } from "vitest";
import { lerConsentimento, sinaisConsentimento, CHAVE_CONSENTIMENTO } from "@/lib/site/consentimento";

describe("consentimento de cookies", () => {
  it("chave estável no navegador", () => {
    expect(CHAVE_CONSENTIMENTO).toBe("yide_consentimento_v1");
  });
  it("lê só valores conhecidos", () => {
    expect(lerConsentimento("aceito")).toBe("aceito");
    expect(lerConsentimento("essencial")).toBe("essencial");
    expect(lerConsentimento("x")).toBeNull();
    expect(lerConsentimento(null)).toBeNull();
  });
  it("aceito libera anúncios e análise", () => {
    expect(sinaisConsentimento("aceito")).toEqual({
      ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted",
    });
  });
  it("essencial e sem resposta negam tudo", () => {
    const negado = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" };
    expect(sinaisConsentimento("essencial")).toEqual(negado);
    expect(sinaisConsentimento(null)).toEqual(negado);
  });
});
