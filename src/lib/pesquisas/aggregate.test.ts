import { describe, it, expect } from "vitest";
import { agregarPergunta } from "./aggregate";

describe("agregarPergunta", () => {
  it("conta escolhas de múltipla escolha (zera opções sem voto)", () => {
    const r = agregarPergunta({ tipo: "multipla_escolha", opcoes: ["A", "B", "C"] }, [
      { escolha: "A" },
      { escolha: "A" },
      { escolha: "B" },
    ]);
    expect(r).toEqual({ tipo: "multipla_escolha", contagem: { A: 2, B: 1, C: 0 }, total: 3 });
  });

  it("média de escala", () => {
    const r = agregarPergunta({ tipo: "escala" }, [{ nota: 4 }, { nota: 2 }]);
    expect(r).toMatchObject({ tipo: "escala", media: 3, total: 2 });
  });

  it("escala sem respostas → média 0", () => {
    const r = agregarPergunta({ tipo: "escala" }, []);
    expect(r).toMatchObject({ tipo: "escala", media: 0, total: 0 });
  });

  it("conta sim/não", () => {
    const r = agregarPergunta({ tipo: "sim_nao" }, [{ sim_nao: true }, { sim_nao: false }, { sim_nao: true }]);
    expect(r).toMatchObject({ tipo: "sim_nao", sim: 2, nao: 1, total: 3 });
  });

  it("lista textos (ignora vazios)", () => {
    const r = agregarPergunta({ tipo: "texto" }, [{ texto: "bom" }, { texto: "" }]);
    expect(r).toMatchObject({ tipo: "texto", textos: ["bom"], total: 2 });
  });
});
