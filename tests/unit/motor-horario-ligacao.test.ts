// tests/unit/motor-horario-ligacao.test.ts
import { describe, it, expect } from "vitest";
import { isHorarioComercial, isHorarioLigacao } from "@/lib/motor-prospeccao/categorias";

// BRT = UTC-3. 2026-11-16 é segunda; 2026-11-21 é sábado.
const seg = (hhmm: string) => new Date(`2026-11-16T${hhmm}:00-03:00`);
const sab = (hhmm: string) => new Date(`2026-11-21T${hhmm}:00-03:00`);

const wpp = {
  horario_inicio: "08:00",
  horario_fim: "20:00",
  horario_inicio_fds: "09:00",
  horario_fim_fds: "17:00",
};

const ligacao = {
  horario_inicio_ligacao: "08:30",
  horario_fim_ligacao: "19:00",
  horario_inicio_ligacao_fds: "09:00",
  horario_fim_ligacao_fds: "17:00",
};

describe("isHorarioLigacao", () => {
  it("respeita a janela de seg-sex (início inclusivo, fim exclusivo)", () => {
    expect(isHorarioLigacao(seg("08:29"), ligacao)).toBe(false);
    expect(isHorarioLigacao(seg("08:30"), ligacao)).toBe(true);
    expect(isHorarioLigacao(seg("18:59"), ligacao)).toBe(true);
    expect(isHorarioLigacao(seg("19:00"), ligacao)).toBe(false);
  });

  it("usa a janela de fim de semana no sábado", () => {
    expect(isHorarioLigacao(sab("08:45"), ligacao)).toBe(false);
    expect(isHorarioLigacao(sab("09:00"), ligacao)).toBe(true);
    expect(isHorarioLigacao(sab("17:00"), ligacao)).toBe(false);
  });

  it("é separado do WhatsApp: 19:30 tem WPP mas não ligação", () => {
    expect(isHorarioComercial(seg("19:30"), wpp)).toBe(true);
    expect(isHorarioLigacao(seg("19:30"), ligacao)).toBe(false);
    expect(isHorarioComercial(seg("08:15"), wpp)).toBe(true);
    expect(isHorarioLigacao(seg("08:15"), ligacao)).toBe(false);
  });

  it("aceita formato time do Postgres (HH:MM:SS)", () => {
    const cfg = { ...ligacao, horario_inicio_ligacao: "08:30:00", horario_fim_ligacao: "19:00:00" };
    expect(isHorarioLigacao(seg("08:30"), cfg)).toBe(true);
    expect(isHorarioLigacao(seg("19:00"), cfg)).toBe(false);
  });

  it("cai no padrão (08:30-19:00 / 09:00-17:00) quando a config não tem as colunas", () => {
    expect(isHorarioLigacao(seg("08:20"), {})).toBe(false);
    expect(isHorarioLigacao(seg("08:30"), {})).toBe(true);
    expect(isHorarioLigacao(seg("19:00"), {})).toBe(false);
    expect(isHorarioLigacao(sab("16:59"), {})).toBe(true);
    expect(isHorarioLigacao(sab("17:00"), {})).toBe(false);
  });
});

describe("isHorarioComercial (WhatsApp)", () => {
  it("mantém a janela de seg-sex e fds", () => {
    expect(isHorarioComercial(seg("07:59"), wpp)).toBe(false);
    expect(isHorarioComercial(seg("08:00"), wpp)).toBe(true);
    expect(isHorarioComercial(seg("20:00"), wpp)).toBe(false);
    expect(isHorarioComercial(sab("08:59"), wpp)).toBe(false);
    expect(isHorarioComercial(sab("16:59"), wpp)).toBe(true);
  });
});
