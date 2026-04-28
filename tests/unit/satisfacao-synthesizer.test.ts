import { describe, it, expect, vi, beforeEach } from "vitest";

const messagesCreateMock = vi.hoisted(() => vi.fn());
const getClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/client", () => ({
  getAnthropicClient: getClientMock,
  SATISFACTION_MODEL: "claude-haiku-4-5",
  MAX_TOKENS: 1024,
}));

import { synthesizeClientSatisfaction } from "@/lib/satisfacao/synthesizer";

beforeEach(() => {
  messagesCreateMock.mockReset();
  getClientMock.mockReset();
});

const baseInput = {
  client: {
    id: "c1",
    nome: "Pizzaria Bella",
    valor_mensal: 4500,
    data_entrada: "2025-08-01",
    servico_contratado: "Social media + tráfego",
  },
  current_week_iso: "2026-W17",
  current_entries: [
    { papel: "coordenador", cor: "verde" as const, comentario: "Cliente satisfeito" },
    { papel: "assessor", cor: "verde" as const, comentario: null },
  ],
  history_4_weeks: [],
};

describe("synthesizeClientSatisfaction", () => {
  it("retorna null se ANTHROPIC_API_KEY não estiver configurado", async () => {
    getClientMock.mockReturnValue(null);
    const r = await synthesizeClientSatisfaction(baseInput);
    expect(r).toBeNull();
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it("parseia JSON válido da IA e retorna SynthesisOutput", async () => {
    getClientMock.mockReturnValue({
      messages: { create: messagesCreateMock },
    });
    messagesCreateMock.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          score_final: 9.2,
          cor_final: "verde",
          resumo_ia: "Cliente em alta satisfação...",
          divergencia_detectada: false,
          acao_sugerida: null,
        }),
      }],
      usage: { input_tokens: 500, output_tokens: 80 },
    });
    const r = await synthesizeClientSatisfaction(baseInput);
    expect(r).not.toBeNull();
    expect(r!.score_final).toBe(9.2);
    expect(r!.cor_final).toBe("verde");
    expect(r!.divergencia_detectada).toBe(false);
    expect(r!.ai_tokens_used).toBe(580);
  });

  it("retorna null se a IA retornar JSON malformado", async () => {
    getClientMock.mockReturnValue({
      messages: { create: messagesCreateMock },
    });
    messagesCreateMock.mockResolvedValue({
      content: [{ type: "text", text: "not json at all" }],
      usage: { input_tokens: 100, output_tokens: 10 },
    });
    const r = await synthesizeClientSatisfaction(baseInput);
    expect(r).toBeNull();
  });

  it("retorna null se a IA lançar erro de rede", async () => {
    getClientMock.mockReturnValue({
      messages: { create: messagesCreateMock },
    });
    messagesCreateMock.mockRejectedValue(new Error("network down"));
    const r = await synthesizeClientSatisfaction(baseInput);
    expect(r).toBeNull();
  });

  it("envia system prompt cached (cache_control ephemeral)", async () => {
    getClientMock.mockReturnValue({
      messages: { create: messagesCreateMock },
    });
    messagesCreateMock.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          score_final: 8,
          cor_final: "verde",
          resumo_ia: "ok",
          divergencia_detectada: false,
          acao_sugerida: null,
        }),
      }],
      usage: { input_tokens: 500, output_tokens: 50 },
    });
    await synthesizeClientSatisfaction(baseInput);
    const args = messagesCreateMock.mock.calls[0][0];
    // System prompt deve ter cache_control: ephemeral no último bloco
    expect(args.system).toBeDefined();
    if (Array.isArray(args.system)) {
      const last = args.system[args.system.length - 1];
      expect(last.cache_control).toEqual({ type: "ephemeral" });
    }
  });
});
