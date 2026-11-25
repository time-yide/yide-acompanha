import { describe, it, expect } from "vitest";
import {
  segundaDaSemana, resolverSemana, erroAoFechar, casarCliente, podeVerCheckDoAssessor,
} from "./core";

describe("segundaDaSemana", () => {
  it("segunda continua segunda", () => expect(segundaDaSemana("2026-11-23")).toBe("2026-11-23"));
  it("quinta volta pra segunda", () => expect(segundaDaSemana("2026-11-26")).toBe("2026-11-23"));
  it("domingo volta pra segunda anterior", () => expect(segundaDaSemana("2026-11-29")).toBe("2026-11-23"));
  it("vira o mês", () => expect(segundaDaSemana("2026-12-02")).toBe("2026-11-30"));
});

describe("resolverSemana", () => {
  it("param inválido usa hoje", () => expect(resolverSemana("xx", "2026-11-25")).toBe("2026-11-23"));
  it("param válido normaliza", () => expect(resolverSemana("2026-11-19", "2026-11-25")).toBe("2026-11-16"));
});

describe("erroAoFechar", () => {
  it("pendente bloqueia", () => {
    expect(erroAoFechar([{ resultado: null, motivo: null }])).toMatch(/Falta marcar 1/);
  });
  it("não feito sem motivo bloqueia", () => {
    expect(erroAoFechar([{ resultado: "nao_feito", motivo: " " }])).toMatch(/motivo/);
  });
  it("ok", () => {
    expect(erroAoFechar([{ resultado: "feito", motivo: null }, { resultado: "nao_feito", motivo: "cliente sumiu" }])).toBeNull();
  });
});

describe("casarCliente", () => {
  const cs = [{ id: "1", nome: "Padaria São João" }, { id: "2", nome: "Ótica Visão" }];
  it("ignora acento e caixa", () => expect(casarCliente("padaria sao joao", cs)).toBe("1"));
  it("parcial único", () => expect(casarCliente("Ótica", cs)).toBe("2"));
  it("sem match", () => expect(casarCliente("Academia", cs)).toBeNull());
});

describe("podeVerCheckDoAssessor", () => {
  it("sócio vê tudo", () => expect(podeVerCheckDoAssessor({ id: "x", role: "socio" }, "a", "em_revisao")).toBe(true));
  it("assessor não vê antes de liberar", () => expect(podeVerCheckDoAssessor({ id: "a", role: "assessor" }, "a", "em_revisao")).toBe(false));
  it("assessor vê o próprio liberado", () => expect(podeVerCheckDoAssessor({ id: "a", role: "assessor" }, "a", "liberado")).toBe(true));
  it("assessor não vê de outro", () => expect(podeVerCheckDoAssessor({ id: "a", role: "assessor" }, "b", "liberado")).toBe(false));
});
