// tests/unit/ligacoes-zenvia.test.ts
import { describe, it, expect } from "vitest";
import { mapStatusZenvia, buildWebhookUrl } from "@/lib/ligacoes/zenvia";

describe("mapStatusZenvia", () => {
  it("atendida -> atendida", () => {
    expect(mapStatusZenvia("atendida", 30)).toBe("atendida");
  });
  it("atendida muito curta (<5s) -> rejeitada", () => {
    expect(mapStatusZenvia("atendida", 3)).toBe("rejeitada");
  });
  it("sem resposta / nao atendida -> perdida", () => {
    expect(mapStatusZenvia("nao_atendida", 0)).toBe("perdida");
    expect(mapStatusZenvia("sem_resposta", 0)).toBe("perdida");
  });
  it("ocupado -> ocupada", () => {
    expect(mapStatusZenvia("ocupado", 0)).toBe("ocupada");
  });
  it("caixa postal -> caixa_postal", () => {
    expect(mapStatusZenvia("caixa_postal", 0)).toBe("caixa_postal");
  });
  it("falha/cancelada -> cancelada", () => {
    expect(mapStatusZenvia("falha", 0)).toBe("cancelada");
    expect(mapStatusZenvia("cancelada", 0)).toBe("cancelada");
  });
  it("desconhecido -> perdida", () => {
    expect(mapStatusZenvia("xpto", 0)).toBe("perdida");
  });
});

describe("buildWebhookUrl", () => {
  it("monta a URL com secret", () => {
    expect(buildWebhookUrl("https://app.x.com", "sec123")).toBe(
      "https://app.x.com/api/webhooks/ligacoes/zenvia?secret=sec123",
    );
  });
});
