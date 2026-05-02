import { describe, it, expect } from "vitest";
import { inferTipoPacote } from "@/lib/clientes/schema";

describe("inferTipoPacote", () => {
  it('classifica "Tráfego+Estratégia" como trafego_estrategia', () => {
    expect(inferTipoPacote("Tráfego+Estratégia")).toBe("trafego_estrategia");
  });
  it('classifica "Trafégo+Estratégia" (e-acute) como trafego_estrategia', () => {
    expect(inferTipoPacote("Trafégo+Estratégia")).toBe("trafego_estrategia");
  });
  it('classifica "Tráfego" solo como trafego', () => {
    expect(inferTipoPacote("Tráfego")).toBe("trafego");
  });
  it('classifica "Estratégia" solo como estrategia', () => {
    expect(inferTipoPacote("Estratégia")).toBe("estrategia");
  });
  it('classifica "Audiovisual" como audiovisual', () => {
    expect(inferTipoPacote("Audiovisual")).toBe("audiovisual");
  });
  it('classifica "CRM" como crm', () => {
    expect(inferTipoPacote("CRM")).toBe("crm");
  });
  it('classifica "CRM+IA" como crm_ia', () => {
    expect(inferTipoPacote("CRM+IA")).toBe("crm_ia");
  });
  it('classifica "IA" solo como ia', () => {
    expect(inferTipoPacote("IA")).toBe("ia");
  });
  it("não confunde 'midia' com 'IA'", () => {
    // bug que existia antes da regex \bia\b
    expect(inferTipoPacote("Mídia paga")).not.toBe("ia");
  });
  it("não confunde 'história' com 'IA'", () => {
    expect(inferTipoPacote("Storytelling: história da marca")).not.toBe("ia");
  });
  it("default trafego_estrategia pra string vazia", () => {
    expect(inferTipoPacote("")).toBe("trafego_estrategia");
    expect(inferTipoPacote(null)).toBe("trafego_estrategia");
  });
  it("default trafego_estrategia pra texto desconhecido", () => {
    expect(inferTipoPacote("Marketing")).toBe("trafego_estrategia");
  });
  it('classifica "Yide 360" como yide_360', () => {
    expect(inferTipoPacote("Yide 360")).toBe("yide_360");
  });
});
