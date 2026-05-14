import { describe, it, expect } from "vitest";
import { LineDelimitedSlideParser } from "@/lib/apresenta-yide/stream-parser";

describe("LineDelimitedSlideParser", () => {
  it("parseia uma linha completa numa única feed", () => {
    const parser = new LineDelimitedSlideParser();
    const slide = JSON.stringify({
      template: "capa",
      content: { template: "capa", titulo: "Yide" },
    });
    const out = parser.feed(slide + "\n");
    expect(out).toHaveLength(1);
    expect(out[0].template).toBe("capa");
  });

  it("buffer entre chunks até receber newline", () => {
    const parser = new LineDelimitedSlideParser();
    const slide = JSON.stringify({
      template: "capa",
      content: { template: "capa", titulo: "Y" },
    });
    expect(parser.feed(slide.slice(0, 10))).toHaveLength(0);
    expect(parser.feed(slide.slice(10))).toHaveLength(0);
    expect(parser.feed("\n")).toHaveLength(1);
  });

  it("parseia múltiplos slides num só chunk", () => {
    const parser = new LineDelimitedSlideParser();
    const s1 = JSON.stringify({ template: "capa", content: { template: "capa", titulo: "A" } });
    const s2 = JSON.stringify({ template: "encerramento", content: { template: "encerramento", mensagem: "Fim" } });
    const out = parser.feed(`${s1}\n${s2}\n`);
    expect(out).toHaveLength(2);
    expect(out[0].template).toBe("capa");
    expect(out[1].template).toBe("encerramento");
  });

  it("descarta linhas vazias", () => {
    const parser = new LineDelimitedSlideParser();
    expect(parser.feed("\n\n\n")).toHaveLength(0);
  });

  it("descarta linhas que não parseiam como JSON válido", () => {
    const parser = new LineDelimitedSlideParser();
    expect(parser.feed("invalid line\n")).toHaveLength(0);
    expect(parser.feed("{ broken\n")).toHaveLength(0);
  });

  it("descarta slides que não passam na validação de shape", () => {
    const parser = new LineDelimitedSlideParser();
    expect(parser.feed('{"template":"capa","content":{}}\n')).toHaveLength(0);
    expect(parser.feed('{"template":"invalido","content":{"template":"invalido"}}\n')).toHaveLength(0);
  });

  it("flush() retorna slide pendente sem newline final", () => {
    const parser = new LineDelimitedSlideParser();
    const slide = JSON.stringify({
      template: "capa",
      content: { template: "capa", titulo: "Y" },
    });
    expect(parser.feed(slide)).toHaveLength(0);
    expect(parser.flush()).toHaveLength(1);
  });

  it("flush() em buffer vazio é no-op", () => {
    const parser = new LineDelimitedSlideParser();
    expect(parser.flush()).toHaveLength(0);
  });
});
