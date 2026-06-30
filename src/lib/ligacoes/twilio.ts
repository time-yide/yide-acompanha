// SERVER ONLY - cliente/helpers da Twilio Voice pro módulo /ligacoes.
import twilio from "twilio";
import { getServerEnv } from "@/lib/env";
import type { StatusLigacao } from "./tipos";

interface TwilioCreds {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  twimlAppSid: string;
}

/** Lê as credenciais; null quando não configurado (caminho fica inerte). */
export function getTwilioCreds(): TwilioCreds | null {
  const e = getServerEnv();
  if (
    !e.TWILIO_ACCOUNT_SID ||
    !e.TWILIO_API_KEY_SID ||
    !e.TWILIO_API_KEY_SECRET ||
    !e.TWILIO_TWIML_APP_SID
  ) {
    return null;
  }
  return {
    accountSid: e.TWILIO_ACCOUNT_SID,
    apiKeySid: e.TWILIO_API_KEY_SID,
    apiKeySecret: e.TWILIO_API_KEY_SECRET,
    twimlAppSid: e.TWILIO_TWIML_APP_SID,
  };
}

/** Mapeia o status da Twilio (DialCallStatus/CallStatus) pro enum interno. */
export function mapStatusTwilio(statusTwilio: string, duracaoSegundos: number): StatusLigacao {
  const s = (statusTwilio || "").toLowerCase();
  if (s === "busy") return "ocupada";
  if (s === "failed" || s === "canceled" || s === "cancelled") return "cancelada";
  if (s === "no-answer" || s === "no_answer") return "perdida";
  if (s === "completed" || s === "answered" || s === "in-progress") {
    return duracaoSegundos < 5 ? "rejeitada" : "atendida";
  }
  return "perdida";
}

/** URL do webhook de status/gravação (vai no TwiML como callback). */
export function buildTwilioWebhookUrl(appUrl: string, webhookSecret: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/webhooks/ligacoes/twilio?secret=${webhookSecret}`;
}

/** URL do proxy autenticado que serve a gravação pro player <audio>. */
export function buildRecordingProxyUrl(appUrl: string, recordingSid: string, webhookSecret: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/ligacoes/twilio/recording?sid=${recordingSid}&secret=${webhookSecret}`;
}

export interface EventoWebhookTwilioParsed {
  externalId: string; // CallSid
  statusInterno: StatusLigacao;
  duracaoSegundos: number;
  recordingSid: string | null;
  raw: Record<string, unknown>;
}

/**
 * Normaliza os dois tipos de callback que recebemos no mesmo endpoint:
 * - action do <Dial>: traz DialCallStatus + DialCallDuration
 * - recordingStatusCallback: traz RecordingSid + RecordingDuration
 */
export function parseEventoWebhookTwilio(payload: Record<string, unknown>): EventoWebhookTwilioParsed {
  const externalId = String(payload.CallSid ?? "");
  const recordingSid = payload.RecordingSid != null ? String(payload.RecordingSid) : null;
  const statusStr = String(payload.DialCallStatus ?? payload.CallStatus ?? "");
  const dur =
    Number(payload.DialCallDuration ?? payload.RecordingDuration ?? payload.CallDuration ?? 0) || 0;
  return {
    externalId,
    statusInterno: mapStatusTwilio(statusStr, dur),
    duracaoSegundos: dur,
    recordingSid,
    raw: payload,
  };
}

/**
 * Gera um Access Token de voz (vida curta) pro navegador. `identity` é o id do
 * colaborador logado. Retorna null se a Twilio não estiver configurada.
 */
export function gerarVoiceToken(identity: string): string | null {
  const c = getTwilioCreds();
  if (!c) return null;
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const token = new AccessToken(c.accountSid, c.apiKeySid, c.apiKeySecret, {
    identity,
    ttl: 3600,
  });
  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: c.twimlAppSid,
      incomingAllow: false,
    }),
  );
  return token.toJwt();
}
