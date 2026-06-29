import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@/lib/ai/client", () => ({
  getAnthropicClient: () => ({ messages: { create } }),
}));

import { gerarLegenda, type CaptionContext } from "@/lib/social-media/caption-generator";

const baseCtx: CaptionContext = {
  clientNome: "Loja X",
  servico: "Estratégia",
  tomVoz: "Descontraído",
  mood: null,
  evitar: null,
  formato: "feed",
  redes: ["instagram"],
  brief: "promoção 20% off",
  rascunho: null,
};

function aiReturns(obj: unknown) {
  create.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(obj) }],
    usage: { input_tokens: 10, output_tokens: 20 },
  });
}

describe("gerarLegenda", () => {
  beforeEach(() => create.mockReset());

  it("retorna legenda e hashtags de um JSON válido", async () => {
    aiReturns({ legenda: "Aproveite!", hashtags: "#promo #loja" });
    const r = await gerarLegenda(baseCtx);
    expect(r).toEqual({ legenda: "Aproveite!", hashtags: "#promo #loja" });
  });

  it("aceita JSON dentro de cercas markdown ```json", async () => {
    create.mockResolvedValueOnce({
      content: [{ type: "text", text: '```json\n{"legenda":"Oi","hashtags":"#a"}\n```' }],
      usage: {},
    });
    const r = await gerarLegenda(baseCtx);
    expect(r).toEqual({ legenda: "Oi", hashtags: "#a" });
  });

  it("erro amigável quando a resposta não é JSON", async () => {
    create.mockResolvedValueOnce({ content: [{ type: "text", text: "não sei" }], usage: {} });
    const r = await gerarLegenda(baseCtx);
    expect(r).toHaveProperty("error");
  });

  it("exige brief ou rascunho (não chama a IA sem nada)", async () => {
    const r = await gerarLegenda({ ...baseCtx, brief: null, rascunho: null });
    expect(r).toHaveProperty("error");
    expect(create).not.toHaveBeenCalled();
  });
});
