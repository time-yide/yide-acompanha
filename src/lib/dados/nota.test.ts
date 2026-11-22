import { describe, expect, it } from "vitest";
import { calcularNota, faixaNota, listarPerdas, cobertura } from "./nota";
import type { CanaisResultado, ResultadoCanal } from "./tipos";

const c = (status: ResultadoCanal["status"], motivo: string | null = null): ResultadoCanal => ({ status, motivo, metricas: {} });
const base = (): CanaisResultado => ({
  site: c("ok"), google: c("ok"), gmn: c("ok"), instagram: c("ok"),
  facebook: c("ok"), anuncios: c("ok"), ecommerce: c("nao_se_aplica"), crm: c("ok"),
});

describe("dados/nota", () => {
  it("tudo ok = 100", () => expect(calcularNota(base())).toBe(100));
  it("fraco vale metade, ausente zero", () => {
    const k = base();
    k.instagram = c("fraco");   // 20 → 10
    k.anuncios = c("ausente");  // 15 → 0
    expect(calcularNota(k)).toBe(75); // (100-10-15)/100
  });
  it("sem_acesso sai da conta", () => {
    const k = base();
    k.site = c("sem_acesso"); k.google = c("sem_acesso");
    k.crm = c("ausente"); // 10 de 70 → 60/70
    expect(calcularNota(k)).toBe(86);
  });
  it("nada medível = null", () => {
    const k = base();
    for (const key of Object.keys(k) as Array<keyof CanaisResultado>) k[key] = c("sem_acesso");
    expect(calcularNota(k)).toBeNull();
  });
  it("faixas", () => {
    expect(faixaNota(49)).toBe("risco");
    expect(faixaNota(50)).toBe("atencao");
    expect(faixaNota(75)).toBe("bom");
    expect(faixaNota(null)).toBe("sem_dados");
  });
  it("perdas: ausente = alta, fraco = média, alta primeiro e por peso", () => {
    const k = base();
    k.facebook = c("fraco", "Sem post no Facebook há 5 dias");
    k.gmn = c("ausente", "Não aparece no Google Maps");
    k.instagram = c("fraco", "Sem post no Instagram há 4 dias");
    k.site = c("sem_acesso", "Google Analytics não conectado");
    expect(listarPerdas(k)).toEqual([
      { canal: "gmn", gravidade: "alta", texto: "Não aparece no Google Maps" },
      { canal: "instagram", gravidade: "media", texto: "Sem post no Instagram há 4 dias" },
      { canal: "facebook", gravidade: "media", texto: "Sem post no Facebook há 5 dias" },
    ]);
  });
  it("cobertura conta canais lidos sobre aplicáveis", () => {
    const k = base();
    k.site = c("sem_acesso");
    expect(cobertura([k])).toEqual({ lidos: 6, total: 7 });
  });
});
