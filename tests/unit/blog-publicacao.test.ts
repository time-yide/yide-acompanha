import { describe, it, expect } from "vitest";
import { camposDePublicacao } from "@/lib/blog/pipeline/publicacao";

const AGORA = "2026-11-03T10:00:00.000Z";
const ARTIGO = "a".repeat(800);

describe("camposDePublicacao", () => {
  it("publica artigo completo com a data de publicação", () => {
    expect(camposDePublicacao(ARTIGO, true, AGORA)).toEqual({ status: "publicado", published_at: AGORA });
  });
  it("artigo curto demais fica de rascunho", () => {
    expect(camposDePublicacao("a".repeat(799), true, AGORA)).toEqual({ status: "rascunho" });
    expect(camposDePublicacao(" ".repeat(900), true, AGORA)).toEqual({ status: "rascunho" });
  });
  it("sem pedido de publicar, sempre rascunho", () => {
    expect(camposDePublicacao(ARTIGO, false, AGORA)).toEqual({ status: "rascunho" });
  });
});
