import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { mapConversa, mapMensagem } from "@/lib/conversas/lyide";

describe("conversas espelho do Lyide", () => {
  it("mapeia conversa: aguardando resposta e IA", () => {
    process.env.LYIDE_API_URL = "https://lyide.test/";
    process.env.LYIDE_API_SECRET = "s";
    const c = mapConversa({
      id: "c1",
      leadId: "l1",
      nome: "Maria",
      telefone: "+5565999999999",
      avatarUrl: null,
      grupo: false,
      aiPausada: true,
      ultimaMsgEm: "2026-11-17T10:00:00.000Z",
      ultimoTexto: "oi",
      ultimaDirecao: "IN",
    });
    expect(c.nao_lidas).toBe(1);
    expect(c.ai_ativa).toBe(false);
    expect(c.lyide_url).toBe("https://lyide.test/leads/l1");
  });

  it("mapeia autor e status da mensagem", () => {
    const m = mapMensagem("c1", {
      id: "m1",
      direcao: "OUT",
      autor: "ia",
      texto: "Olá!",
      tipo: "TEXT",
      status: "READ",
      remetente: null,
      criadaEm: "2026-11-17T10:00:00.000Z",
    });
    expect(m.autor).toBe("ia");
    expect(m.status).toBe("lida");
    expect(mapMensagem("c1", { ...m, id: "m2", direcao: "IN", autor: "cliente", texto: "x", tipo: "TEXT", status: "SENT", remetente: null, criadaEm: m.created_at }).autor).toBe("lead");
  });
});
