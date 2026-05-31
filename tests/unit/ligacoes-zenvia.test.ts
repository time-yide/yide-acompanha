// tests/unit/ligacoes-zenvia.test.ts
import { describe, it, expect } from "vitest";
import { mapStatusZenvia, buildWebhookUrl } from "@/lib/ligacoes/zenvia";
import { parseEventoWebhook } from "@/lib/ligacoes/zenvia";

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

describe("parseEventoWebhook", () => {
  it("extrai campos do payload da Zenvia", () => {
    const r = parseEventoWebhook({
      id: "abc123",
      status: "atendida",
      duracao_segundos: 65,
      duracao_falada_segundos: 60,
      preco: 0.18,
      url_gravacao: "https://x/rec.mp3",
      motivo_desconexao: "normal",
    });
    expect(r.externalId).toBe("abc123");
    expect(r.statusInterno).toBe("atendida");
    expect(r.duracaoSegundos).toBe(65);
    expect(r.gravacaoUrl).toBe("https://x/rec.mp3");
  });
  it("status curto vira rejeitada", () => {
    const r = parseEventoWebhook({ id: "x", status: "atendida", duracao_segundos: 4, duracao_falada_segundos: 2 });
    expect(r.statusInterno).toBe("rejeitada");
  });
  it("sem id retorna externalId vazio", () => {
    const r = parseEventoWebhook({ status: "ocupado" });
    expect(r.externalId).toBe("");
    expect(r.statusInterno).toBe("ocupada");
  });
});

import { iniciarLigacaoSchema } from "@/lib/ligacoes/schema";

describe("iniciarLigacaoSchema", () => {
  it("aceita número + instancia válidos", () => {
    const r = iniciarLigacaoSchema.safeParse({
      numero: "+5511999998888",
      instancia_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(r.success).toBe(true);
  });
  it("rejeita número curto", () => {
    const r = iniciarLigacaoSchema.safeParse({ numero: "123", instancia_id: "11111111-1111-1111-1111-111111111111" });
    expect(r.success).toBe(false);
  });
});
