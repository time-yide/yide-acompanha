// tests/unit/motor-horario-ligacao.test.ts
import { describe, it, expect } from "vitest";
import {
  isHorarioComercial,
  isHorarioLigacao,
  parseHorario,
  validarJanelaHorario,
  LIGACAO_LIMITE_MIN,
  LIGACAO_LIMITE_MAX,
} from "@/lib/motor-prospeccao/categorias";

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

describe("parseHorario", () => {
  it("aceita HH:MM e HH:MM:SS", () => {
    expect(parseHorario("08:30")).toBe(510);
    expect(parseHorario("19:00:00")).toBe(1140);
    expect(parseHorario("00:00")).toBe(0);
    expect(parseHorario("23:59")).toBe(1439);
  });

  it("rejeita valores malformados (nunca vira 0)", () => {
    for (const v of ["", "abc", "8:30", "24:00", "12:60", "12:30:99", "08:30x", " : ", null, undefined, 830]) {
      expect(parseHorario(v)).toBeNull();
    }
  });
});

describe("fail closed com horário malformado", () => {
  it("ligação: valor inválido cai na janela padrão, não libera o dia todo", () => {
    const ruim = { ...ligacao, horario_inicio_ligacao: "abc", horario_fim_ligacao: "xx:yy" };
    expect(isHorarioLigacao(seg("00:30"), ruim)).toBe(false);
    expect(isHorarioLigacao(seg("08:00"), ruim)).toBe(false);
    expect(isHorarioLigacao(seg("08:30"), ruim)).toBe(true);
    expect(isHorarioLigacao(seg("19:00"), ruim)).toBe(false);
  });

  it("ligação: só o fim inválido também usa a janela padrão inteira", () => {
    const ruim = { ...ligacao, horario_inicio_ligacao: "00:00", horario_fim_ligacao: "lixo" };
    expect(isHorarioLigacao(seg("02:00"), ruim)).toBe(false);
  });

  it("ligação: fim <= início cai na janela padrão", () => {
    const inv = { ...ligacao, horario_inicio_ligacao: "19:00", horario_fim_ligacao: "08:00" };
    expect(isHorarioLigacao(seg("23:00"), inv)).toBe(false);
    expect(isHorarioLigacao(seg("10:00"), inv)).toBe(true);
  });

  it("WhatsApp: valor inválido bloqueia a janela", () => {
    const ruim = { ...wpp, horario_inicio: "lixo" };
    expect(isHorarioComercial(seg("00:30"), ruim)).toBe(false);
    expect(isHorarioComercial(seg("12:00"), ruim)).toBe(false);
  });
});

describe("validarJanelaHorario", () => {
  const lim = { min: LIGACAO_LIMITE_MIN, max: LIGACAO_LIMITE_MAX };

  it("aceita janela válida dentro dos limites", () => {
    expect(validarJanelaHorario("Ligações IA", "08:30", "19:00", lim)).toBeNull();
    expect(validarJanelaHorario("Ligações IA", "08:00", "20:00", lim)).toBeNull();
    expect(validarJanelaHorario("WhatsApp", "07:00", "22:00")).toBeNull();
  });

  it("rejeita formato inválido", () => {
    expect(validarJanelaHorario("Ligações IA", "abc", "19:00", lim)).toMatch(/inválido/);
  });

  it("rejeita fim <= início", () => {
    expect(validarJanelaHorario("WhatsApp", "18:00", "18:00")).toMatch(/depois do início/);
    expect(validarJanelaHorario("WhatsApp", "19:00", "08:00")).toMatch(/depois do início/);
  });

  it("limita ligações a 08:00–20:00", () => {
    expect(validarJanelaHorario("Ligações IA", "07:30", "19:00", lim)).toMatch(/entre 08:00 e 20:00/);
    expect(validarJanelaHorario("Ligações IA", "09:00", "21:00", lim)).toMatch(/entre 08:00 e 20:00/);
  });
});
