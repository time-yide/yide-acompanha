import { describe, it, expect } from "vitest";
import {
  objetivoParaMeta,
  reaisParaCents,
  montarTargeting,
} from "@/lib/trafego/meta-create-map";

describe("objetivoParaMeta", () => {
  it("mapeia tráfego → OUTCOME_TRAFFIC / LINK_CLICKS / LEARN_MORE", () => {
    expect(objetivoParaMeta("trafego")).toEqual({
      objective: "OUTCOME_TRAFFIC",
      optimizationGoal: "LINK_CLICKS",
      callToAction: "LEARN_MORE",
    });
  });

  it("mapeia engajamento → OUTCOME_ENGAGEMENT / POST_ENGAGEMENT / LEARN_MORE", () => {
    expect(objetivoParaMeta("engajamento")).toEqual({
      objective: "OUTCOME_ENGAGEMENT",
      optimizationGoal: "POST_ENGAGEMENT",
      callToAction: "LEARN_MORE",
    });
  });

  it("retorna null pra objetivos não suportados no v1", () => {
    for (const o of ["conversoes", "leads", "mensagens", "vendas", "video", "alcance", "instalacoes"]) {
      expect(objetivoParaMeta(o)).toBeNull();
    }
  });

  it("retorna null pra null/undefined/vazio", () => {
    expect(objetivoParaMeta(null)).toBeNull();
    expect(objetivoParaMeta(undefined)).toBeNull();
    expect(objetivoParaMeta("")).toBeNull();
  });
});

describe("reaisParaCents", () => {
  it("converte reais inteiros pra centavos", () => {
    expect(reaisParaCents(30)).toBe(3000);
    expect(reaisParaCents(100)).toBe(10000);
  });

  it("arredonda frações", () => {
    expect(reaisParaCents(12.5)).toBe(1250);
    expect(reaisParaCents(12.555)).toBe(1256);
    expect(reaisParaCents(0.019)).toBe(2);
  });

  it("rejeita <= 0 e valores inválidos", () => {
    expect(() => reaisParaCents(0)).toThrow();
    expect(() => reaisParaCents(-5)).toThrow();
    expect(() => reaisParaCents(NaN)).toThrow();
    // @ts-expect-error testando input inválido
    expect(() => reaisParaCents("30")).toThrow();
  });
});

describe("montarTargeting", () => {
  it("aplica defaults quando input vazio", () => {
    expect(montarTargeting()).toEqual({
      geo_locations: { countries: ["BR"] },
      age_min: 18,
      age_max: 65,
    });
  });

  it("aplica defaults quando objeto sem campos", () => {
    expect(montarTargeting({})).toEqual({
      geo_locations: { countries: ["BR"] },
      age_min: 18,
      age_max: 65,
    });
  });

  it("respeita países, idade e normaliza uppercase", () => {
    expect(montarTargeting({ paises: ["br", "us"], idadeMin: 25, idadeMax: 45 })).toEqual({
      geo_locations: { countries: ["BR", "US"] },
      age_min: 25,
      age_max: 45,
    });
  });

  it("inclui genders só quando é um único gênero", () => {
    expect(montarTargeting({ generos: [1] }).genders).toEqual([1]);
    expect(montarTargeting({ generos: [2] }).genders).toEqual([2]);
  });

  it("omite genders quando ambos ou vazio (= todos)", () => {
    expect(montarTargeting({ generos: [1, 2] }).genders).toBeUndefined();
    expect(montarTargeting({ generos: [] }).genders).toBeUndefined();
    expect(montarTargeting({}).genders).toBeUndefined();
  });

  it("ignora valores de gênero inválidos", () => {
    expect(montarTargeting({ generos: [0, 3, 1] }).genders).toEqual([1]);
    expect(montarTargeting({ generos: [9, 9] }).genders).toBeUndefined();
  });

  it("cai pro default BR se países ficarem vazios após limpeza", () => {
    expect(montarTargeting({ paises: ["  "] }).geo_locations.countries).toEqual(["BR"]);
  });
});
