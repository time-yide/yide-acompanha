import { describe, expect, it } from "vitest";
import { janelaFechada } from "./janela";

const agora = new Date("2026-11-17T12:00:00Z");
const msg = (autor: "lead" | "comercial" | "ia", horasAtras: number) => ({
  autor,
  created_at: new Date(agora.getTime() - horasAtras * 3_600_000).toISOString(),
});

describe("janelaFechada", () => {
  it("aberta até 24h depois da última mensagem do cliente", () => {
    expect(janelaFechada([msg("lead", 30), msg("lead", 2), msg("comercial", 1)], agora)).toBe(false);
    expect(janelaFechada([msg("lead", 23.9)], agora)).toBe(false);
  });

  it("fechada depois de 24h, mesmo com resposta nossa depois", () => {
    expect(janelaFechada([msg("lead", 25), msg("comercial", 1), msg("ia", 1)], agora)).toBe(true);
  });

  it("fechada quando o cliente nunca escreveu", () => {
    expect(janelaFechada([], agora)).toBe(true);
    expect(janelaFechada([msg("comercial", 1)], agora)).toBe(true);
  });
});
