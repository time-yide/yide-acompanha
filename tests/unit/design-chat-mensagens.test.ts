// tests/unit/design-chat-mensagens.test.ts
import { describe, it, expect } from "vitest";
import { montarMensagensChat } from "@/lib/design/chat-utils";

describe("montarMensagensChat", () => {
  it("converte histórico + nova mensagem no formato da Anthropic", () => {
    const msgs = montarMensagensChat(
      [{ role: "user", content: "oi" }, { role: "assistant", content: "olá" }],
      "cria um post",
    );
    expect(msgs).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "olá" },
      { role: "user", content: "cria um post" },
    ]);
  });
  it("ignora roles inválidas do histórico", () => {
    const msgs = montarMensagensChat(
      // @ts-expect-error teste de runtime
      [{ role: "system", content: "x" }, { role: "user", content: "oi" }],
      "vai",
    );
    expect(msgs).toEqual([
      { role: "user", content: "oi" },
      { role: "user", content: "vai" },
    ]);
  });
});
