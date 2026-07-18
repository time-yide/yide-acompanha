import { describe, it, expect } from "vitest";
import {
  contaComoEntrega,
  faturamentoPeriodo,
  valorPorEntrega,
  receitaAtribuida,
  lucroPeriodo,
  agregarTimeAudiovisual,
  isRoleExcluido,
  isRoleTimeAudiovisual,
} from "./lucro";

describe("contaComoEntrega", () => {
  it("operacional entrega em concluida ou postada", () => {
    expect(contaComoEntrega("concluida", "videomaker")).toBe(true);
    expect(contaComoEntrega("postada", "editor")).toBe(true);
    expect(contaComoEntrega("em_andamento", "editor")).toBe(false);
  });
  it("não-operacional só entrega em postada", () => {
    expect(contaComoEntrega("concluida", "assessor")).toBe(false);
    expect(contaComoEntrega("postada", "assessor")).toBe(true);
  });
});

describe("faturamentoPeriodo", () => {
  it("prorateia a carteira pelos dias úteis", () => {
    expect(faturamentoPeriodo(22000, 13, 22)).toBe(13000);
    expect(faturamentoPeriodo(22000, 1, 22)).toBe(1000);
  });
  it("retorna 0 se diasUteisMes inválido", () => {
    expect(faturamentoPeriodo(22000, 5, 0)).toBe(0);
  });
});

describe("valorPorEntrega", () => {
  it("divide faturamento pelas entregas", () => {
    expect(valorPorEntrega(13000, 10)).toBe(1300);
  });
  it("null quando 0 entregas ou 0 faturamento", () => {
    expect(valorPorEntrega(13000, 0)).toBeNull();
    expect(valorPorEntrega(0, 10)).toBeNull();
  });
});

describe("receitaAtribuida / lucroPeriodo", () => {
  it("receita = valor/entrega × entregas", () => {
    expect(receitaAtribuida(1300, 3)).toBe(3900);
    expect(receitaAtribuida(null, 3)).toBeNull();
  });
  it("lucro = receita − custo; null se faltar parte", () => {
    expect(lucroPeriodo(3900, 1359.09)).toBe(2540.91);
    expect(lucroPeriodo(null, 100)).toBeNull();
    expect(lucroPeriodo(3900, null)).toBeNull();
  });
});

describe("agregarTimeAudiovisual", () => {
  it("soma receita/custo dos produtores + salário do coord", () => {
    const time = agregarTimeAudiovisual(
      [
        { receita_periodo: 3900, custo_periodo: 1359.09, entregas_periodo: 3, tempo_ativo_seg_hoje: 3600, tarefas_atrasadas: 1, capturas_atrasadas: 0 },
        { receita_periodo: 1300, custo_periodo: 1000, entregas_periodo: 1, tempo_ativo_seg_hoje: 1800, tarefas_atrasadas: 0, capturas_atrasadas: 2 },
      ],
      1772.73,
    );
    expect(time.receita).toBe(5200);
    expect(time.custo).toBe(4131.82);
    expect(time.lucro).toBe(1068.18);
    expect(time.entregas).toBe(4);
    expect(time.tempo_ativo_seg).toBe(5400);
    expect(time.atrasados).toBe(3);
    expect(time.produtores).toBe(2);
  });
  it("trata custo null (sem salário) como 0", () => {
    const time = agregarTimeAudiovisual(
      [{ receita_periodo: 1000, custo_periodo: null, entregas_periodo: 1, tempo_ativo_seg_hoje: 0, tarefas_atrasadas: 0, capturas_atrasadas: 0 }],
      null,
    );
    expect(time.custo).toBe(0);
    expect(time.lucro).toBe(1000);
  });
});

describe("classificadores de cargo", () => {
  it("exclui coordenador e socio", () => {
    expect(isRoleExcluido("coordenador")).toBe(true);
    expect(isRoleExcluido("socio")).toBe(true);
    expect(isRoleExcluido("videomaker")).toBe(false);
    expect(isRoleExcluido("audiovisual_chefe")).toBe(false);
  });
  it("time audiovisual = produtores (sem o chefe)", () => {
    expect(isRoleTimeAudiovisual("videomaker")).toBe(true);
    expect(isRoleTimeAudiovisual("fast_midia")).toBe(true);
    expect(isRoleTimeAudiovisual("designer")).toBe(true);
    expect(isRoleTimeAudiovisual("editor")).toBe(true);
    expect(isRoleTimeAudiovisual("audiovisual_chefe")).toBe(false);
  });
});
