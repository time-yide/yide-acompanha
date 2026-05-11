import { describe, it, expect } from "vitest";
import { derivarStatusAtual } from "@/lib/dashboard/audiovisual-status";

describe("derivarStatusAtual", () => {
  it("concluida_em setado -> Concluída", () => {
    const r = derivarStatusAtual({ concluida_em: "2026-05-11T10:00:00Z", task: null });
    expect(r.statusAtual).toBe("Concluída");
    expect(r.statusDetalhe).toBe(null);
  });

  it("task em postada -> Concluída", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: { status: "postada" } });
    expect(r.statusAtual).toBe("Concluída");
    expect(r.statusDetalhe).toBe(null);
  });

  it("task em aprovada -> Concluída (terminal)", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: { status: "aprovada" } });
    expect(r.statusAtual).toBe("Concluída");
    expect(r.statusDetalhe).toBe(null);
  });

  it("task em concluida -> Concluída (terminal)", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: { status: "concluida" } });
    expect(r.statusAtual).toBe("Concluída");
    expect(r.statusDetalhe).toBe(null);
  });

  it("task em em_andamento -> Em edição: Em andamento", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: { status: "em_andamento" } });
    expect(r.statusAtual).toBe("Em edição");
    expect(r.statusDetalhe).toBe("Em andamento");
  });

  it("task em alteracao -> Em edição: Alteração", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: { status: "alteracao" } });
    expect(r.statusAtual).toBe("Em edição");
    expect(r.statusDetalhe).toBe("Alteração");
  });

  it("task em aberta -> Em edição: Aberta", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: { status: "aberta" } });
    expect(r.statusAtual).toBe("Em edição");
    expect(r.statusDetalhe).toBe("Aberta");
  });

  it("task em em_aprovacao -> Em edição: Em aprovação", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: { status: "em_aprovacao" } });
    expect(r.statusAtual).toBe("Em edição");
    expect(r.statusDetalhe).toBe("Em aprovação");
  });

  it("sem task -> Aguardando delegação", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: null });
    expect(r.statusAtual).toBe("Aguardando delegação");
    expect(r.statusDetalhe).toBe(null);
  });

  it("concluida_em tem prioridade sobre task postada", () => {
    const r = derivarStatusAtual({ concluida_em: "2026-05-11T10:00:00Z", task: { status: "postada" } });
    expect(r.statusAtual).toBe("Concluída");
  });

  it("concluida_em tem prioridade sobre task em_andamento", () => {
    const r = derivarStatusAtual({ concluida_em: "2026-05-11T10:00:00Z", task: { status: "em_andamento" } });
    expect(r.statusAtual).toBe("Concluída");
  });
});
