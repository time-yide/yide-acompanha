import { describe, it, expect } from "vitest";
import { addDiasUteis, prazoEdicaoPadrao } from "@/lib/datas/dias-uteis";
import { validarEdicaoUrgente, parseEdicaoUrgente } from "./edicao-urgente";

describe("dias úteis", () => {
  it("segunda + 3 = quinta", () => {
    expect(prazoEdicaoPadrao("2026-11-23")).toBe("2026-11-26");
  });
  it("sexta + 3 = quarta", () => {
    expect(prazoEdicaoPadrao("2026-11-27")).toBe("2026-12-02");
  });
  it("sábado + 1 = segunda", () => {
    expect(addDiasUteis("2026-11-28", 1)).toBe("2026-11-30");
  });
  it("vira o mês/ano", () => {
    expect(addDiasUteis("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("validarEdicaoUrgente", () => {
  const gravacao = "2026-11-23"; // seg → prazo qui 26

  it("exige resposta", () => {
    expect(validarEdicaoUrgente({ urgente: null, data: null, qtd: null }, gravacao)).toMatch(/Sim ou Não/);
  });
  it("Não passa sem mais nada", () => {
    expect(validarEdicaoUrgente({ urgente: false, data: null, qtd: null }, gravacao)).toBeNull();
  });
  it("Sim exige data e qtd", () => {
    expect(validarEdicaoUrgente({ urgente: true, data: null, qtd: 1 }, gravacao)).toMatch(/data/);
    expect(validarEdicaoUrgente({ urgente: true, data: "2026-11-24", qtd: null }, gravacao)).toMatch(/quantos/);
  });
  it("data antes da gravação é erro", () => {
    expect(validarEdicaoUrgente({ urgente: true, data: "2026-11-22", qtd: 1 }, gravacao)).toMatch(/antes da gravação/);
  });
  it("data no prazo normal é erro", () => {
    expect(validarEdicaoUrgente({ urgente: true, data: "2026-11-26", qtd: 1 }, gravacao)).toMatch(/prazo normal/);
  });
  it("mesmo dia da gravação vale", () => {
    expect(validarEdicaoUrgente({ urgente: true, data: "2026-11-23", qtd: 1 }, gravacao)).toBeNull();
  });
  it("qtd maior que total de vídeos é erro", () => {
    expect(validarEdicaoUrgente({ urgente: true, data: "2026-11-24", qtd: 5 }, gravacao, 4)).toMatch(/total/);
  });
});

describe("parseEdicaoUrgente", () => {
  it("lê sim com data e qtd", () => {
    const f = new FormData();
    f.set("edicao_urgente", "sim");
    f.set("edicao_urgente_data", "2026-11-24");
    f.set("edicao_urgente_qtd", "2");
    expect(parseEdicaoUrgente(f)).toEqual({ urgente: true, data: "2026-11-24", qtd: 2 });
  });
  it("não zera data/qtd", () => {
    const f = new FormData();
    f.set("edicao_urgente", "nao");
    f.set("edicao_urgente_data", "2026-11-24");
    expect(parseEdicaoUrgente(f)).toEqual({ urgente: false, data: null, qtd: null });
  });
  it("vazio = null", () => {
    expect(parseEdicaoUrgente(new FormData()).urgente).toBeNull();
  });
});
