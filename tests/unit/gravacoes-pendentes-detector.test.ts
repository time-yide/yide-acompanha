import { describe, it, expect } from "vitest";
import { dentroDaJanela, calcMinutosAteInicio } from "@/lib/cron/detectors/gravacoes-pendentes";

describe("dentroDaJanela", () => {
  it("aceita 24h00 (centro da janela 24h)", () => {
    expect(dentroDaJanela(24 * 60, "24h")).toBe(true);
  });
  it("aceita 23h55 (borda inferior)", () => {
    expect(dentroDaJanela(23 * 60 + 55, "24h")).toBe(true);
  });
  it("aceita 24h05 (borda superior)", () => {
    expect(dentroDaJanela(24 * 60 + 5, "24h")).toBe(true);
  });
  it("rejeita 23h54 (fora por 1 min)", () => {
    expect(dentroDaJanela(23 * 60 + 54, "24h")).toBe(false);
  });
  it("rejeita 24h06 (fora por 1 min)", () => {
    expect(dentroDaJanela(24 * 60 + 6, "24h")).toBe(false);
  });
  it("janela 3h: aceita 2h55 a 3h05", () => {
    expect(dentroDaJanela(175, "3h")).toBe(true);
    expect(dentroDaJanela(185, "3h")).toBe(true);
    expect(dentroDaJanela(174, "3h")).toBe(false);
  });
  it("janela 2h: aceita 1h55 a 2h05", () => {
    expect(dentroDaJanela(115, "2h")).toBe(true);
    expect(dentroDaJanela(125, "2h")).toBe(true);
    expect(dentroDaJanela(126, "2h")).toBe(false);
  });
});

describe("calcMinutosAteInicio", () => {
  it("retorna positivo pra evento no futuro", () => {
    const now = new Date("2026-05-28T10:00:00Z");
    const inicio = "2026-05-28T13:00:00Z";
    expect(calcMinutosAteInicio(inicio, now)).toBe(180);
  });
  it("retorna negativo pra evento no passado", () => {
    const now = new Date("2026-05-28T10:00:00Z");
    const inicio = "2026-05-28T09:00:00Z";
    expect(calcMinutosAteInicio(inicio, now)).toBe(-60);
  });
});
