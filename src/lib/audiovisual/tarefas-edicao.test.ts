import { describe, it, expect } from "vitest";
import { planejarTarefasEdicao, type CapturaParaEdicao } from "./tarefas-edicao";

function cap(over: Partial<CapturaParaEdicao> = {}): CapturaParaEdicao {
  return {
    id: "c1",
    client_id: "cl1",
    drive_url: "https://drive.google.com/x",
    qtd_videos: 4,
    qtd_fotos: 2,
    pontos_positivos: null,
    pontos_dificuldade: null,
    sugestoes: null,
    observacoes: null,
    data_captacao: "2026-11-27", // sexta → prazo quarta 02/12
    task_id: null,
    cliente: { id: "cl1", nome: "Padaria", assessor_id: "a1" },
    ...over,
  };
}

describe("planejarTarefasEdicao", () => {
  it("sem urgência: 1 tarefa, prazo 3 dias úteis da gravação", () => {
    const p = planejarTarefasEdicao(cap({ edicao_urgente: false }));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ tipo: "normal", prioridade: "media", due_date: "2026-12-02" });
    expect(p[0].titulo).toBe("Editar: Padaria (27/11/2026)");
  });

  it("com urgência parcial: urgente + normal", () => {
    const p = planejarTarefasEdicao(
      cap({ edicao_urgente: true, edicao_urgente_data: "2026-11-30", edicao_urgente_qtd: 1 }),
    );
    expect(p.map((x) => x.tipo)).toEqual(["urgente", "normal"]);
    expect(p[0]).toMatchObject({ prioridade: "alta", due_date: "2026-11-30" });
    expect(p[0].titulo).toMatch(/^URGENTE/);
    expect(p[0].descricao).toMatch(/1 vídeo\(s\) urgente/);
    expect(p[1]).toMatchObject({ prioridade: "media", due_date: "2026-12-02" });
    expect(p[1].descricao).toMatch(/3 vídeo\(s\)/);
  });

  it("todos urgentes: só a urgente", () => {
    const p = planejarTarefasEdicao(
      cap({ edicao_urgente: true, edicao_urgente_data: "2026-11-30", edicao_urgente_qtd: 4 }),
    );
    expect(p).toHaveLength(1);
    expect(p[0].tipo).toBe("urgente");
  });

  it("urgente sem data é tratado como normal", () => {
    const p = planejarTarefasEdicao(cap({ edicao_urgente: true, edicao_urgente_data: null, edicao_urgente_qtd: 1 }));
    expect(p).toHaveLength(1);
    expect(p[0].tipo).toBe("normal");
  });
});
