import { describe, it, expect } from "vitest";
import { statusDaTarefaPorDestino } from "./task-sync";

describe("statusDaTarefaPorDestino", () => {
  it("alteracao volta o card pra Alteração", () => {
    expect(statusDaTarefaPorDestino("alteracao")).toEqual({ status: "alteracao", status_aprovacao: "ajustes_solicitados" });
  });
  it("em_aprovacao manda pra Aprovação do cliente", () => {
    expect(statusDaTarefaPorDestino("em_aprovacao")).toEqual({ status: "em_aprovacao", status_aprovacao: "em_analise" });
  });
  it("aprovada fecha a aprovação do cliente", () => {
    expect(statusDaTarefaPorDestino("aprovada")).toEqual({ status: "aprovada", status_aprovacao: "aprovada" });
  });
});
