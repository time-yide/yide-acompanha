import { describe, it, expect } from "vitest";
import { isTarefaAtrasadaParaCargo } from "@/lib/tarefas/overdue-rules";

// As candidatas já vêm pré-filtradas (prazo vencido, não deletada, status != postada).
// Aqui testamos só o critério POR CARGO em cima do status restante.

describe("isTarefaAtrasadaParaCargo — cargos operacionais (entregam em concluída)", () => {
  const operacionais = [
    "editor",
    "videomaker",
    "fast_midia",
    "designer",
    "audiovisual_chefe",
    "coordenador",
  ];

  it("conta como atrasada enquanto está em aberto (aberta/em_andamento/alteracao)", () => {
    for (const role of operacionais) {
      expect(isTarefaAtrasadaParaCargo("aberta", role)).toBe(true);
      expect(isTarefaAtrasadaParaCargo("em_andamento", role)).toBe(true);
      expect(isTarefaAtrasadaParaCargo("alteracao", role)).toBe(true);
    }
  });

  it("NÃO conta a partir de Concluído operacional (concluida em diante)", () => {
    for (const role of operacionais) {
      expect(isTarefaAtrasadaParaCargo("concluida", role)).toBe(false);
      expect(isTarefaAtrasadaParaCargo("em_aprovacao", role)).toBe(false);
      expect(isTarefaAtrasadaParaCargo("aprovada", role)).toBe(false);
      expect(isTarefaAtrasadaParaCargo("agendado", role)).toBe(false);
    }
  });
});

describe("isTarefaAtrasadaParaCargo — cargos de entrega final (só postada entrega)", () => {
  const finais = [
    "assessor",
    "assessor_ecommerce",
    "assistente_ecommerce",
    "adm",
    "socio",
    "comercial",
    "programacao",
  ];

  it("conta como atrasada em qualquer status < postada, INCLUSIVE concluída", () => {
    for (const role of finais) {
      expect(isTarefaAtrasadaParaCargo("aberta", role)).toBe(true);
      expect(isTarefaAtrasadaParaCargo("em_andamento", role)).toBe(true);
      expect(isTarefaAtrasadaParaCargo("concluida", role)).toBe(true);
      expect(isTarefaAtrasadaParaCargo("em_aprovacao", role)).toBe(true);
      expect(isTarefaAtrasadaParaCargo("aprovada", role)).toBe(true);
      expect(isTarefaAtrasadaParaCargo("agendado", role)).toBe(true);
    }
  });
});

describe("isTarefaAtrasadaParaCargo — cargo desconhecido/nulo", () => {
  it("cai no critério de entrega final (postada) por segurança", () => {
    expect(isTarefaAtrasadaParaCargo("concluida", null)).toBe(true);
    expect(isTarefaAtrasadaParaCargo("concluida", undefined)).toBe(true);
    expect(isTarefaAtrasadaParaCargo("em_andamento", "cargo_inexistente")).toBe(true);
  });
});
