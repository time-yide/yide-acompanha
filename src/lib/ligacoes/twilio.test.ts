import { describe, it, expect } from "vitest";
import {
  mapStatusTwilio,
  parseEventoWebhookTwilio,
  buildTwilioWebhookUrl,
  buildRecordingProxyUrl,
  TWIML_VAZIO,
} from "./twilio";

describe("mapStatusTwilio", () => {
  it("completed com duração vira atendida", () => {
    expect(mapStatusTwilio("completed", 12)).toBe("atendida");
  });
  it("completed curtíssima vira rejeitada", () => {
    expect(mapStatusTwilio("completed", 2)).toBe("rejeitada");
  });
  it("busy vira ocupada", () => {
    expect(mapStatusTwilio("busy", 0)).toBe("ocupada");
  });
  it("no-answer vira perdida", () => {
    expect(mapStatusTwilio("no-answer", 0)).toBe("perdida");
  });
  it("failed/canceled vira cancelada", () => {
    expect(mapStatusTwilio("failed", 0)).toBe("cancelada");
    expect(mapStatusTwilio("canceled", 0)).toBe("cancelada");
  });
  it("desconhecido vira perdida", () => {
    expect(mapStatusTwilio("seila", 0)).toBe("perdida");
  });
});

describe("parseEventoWebhookTwilio", () => {
  it("extrai status final do callback de Dial", () => {
    const ev = parseEventoWebhookTwilio({
      CallSid: "CA123",
      DialCallStatus: "completed",
      DialCallDuration: "30",
    });
    expect(ev.externalId).toBe("CA123");
    expect(ev.statusInterno).toBe("atendida");
    expect(ev.duracaoSegundos).toBe(30);
    expect(ev.recordingSid).toBeNull();
  });

  it("extrai RecordingSid do callback de gravação", () => {
    const ev = parseEventoWebhookTwilio({
      CallSid: "CA123",
      RecordingSid: "RE999",
      RecordingDuration: "27",
    });
    expect(ev.externalId).toBe("CA123");
    expect(ev.recordingSid).toBe("RE999");
    expect(ev.duracaoSegundos).toBe(27);
  });
});

describe("buildTwilioWebhookUrl / buildRecordingProxyUrl", () => {
  it("monta a URL do webhook sem barra dupla", () => {
    expect(buildTwilioWebhookUrl("https://app.com/", "sek")).toBe(
      "https://app.com/api/webhooks/ligacoes/twilio?secret=sek",
    );
  });
  it("monta a URL do proxy de gravação", () => {
    expect(buildRecordingProxyUrl("https://app.com", "RE1", "CA9")).toBe(
      "https://app.com/api/ligacoes/twilio/recording?sid=RE1&call=CA9",
    );
  });
});

describe("TWIML_VAZIO", () => {
  // Regressão: o webhook precisa responder TwiML no callback de <Dial action>.
  // Responder JSON fazia a Twilio anunciar "an application error has occurred".
  it("é um documento TwiML Response válido, não JSON", () => {
    expect(TWIML_VAZIO).toContain("<Response>");
    expect(TWIML_VAZIO).toContain("</Response>");
    expect(() => JSON.parse(TWIML_VAZIO)).toThrow();
  });
});
