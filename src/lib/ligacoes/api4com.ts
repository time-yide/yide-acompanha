import "server-only";
import { getServerEnv } from "@/lib/env";
import type { StatusLigacao } from "./tipos";

interface Api4ComCreds {
  apiToken: string;
  apiUrl: string;
  domain: string;
  defaultExtension: string;
  defaultExtensionPassword: string;
}

export function getApi4ComCreds(): Api4ComCreds | null {
  const e = getServerEnv();
  if (!e.API4COM_API_TOKEN || !e.API4COM_DOMAIN) return null;
  return {
    apiToken: e.API4COM_API_TOKEN,
    apiUrl: e.API4COM_API_URL || "https://api.api4com.com/api/v1",
    domain: e.API4COM_DOMAIN,
    defaultExtension: e.API4COM_DEFAULT_EXTENSION || "1000",
    defaultExtensionPassword: e.API4COM_DEFAULT_EXTENSION_PASSWORD || "",
  };
}

export interface Api4ComCallPayload {
  caller: string;
  called: string;
  extension: string;
  metadata?: Record<string, unknown>;
}

export interface Api4ComCallResult {
  id: string;
  status: string;
  message: string;
}

export async function api4comFazerLigacao(
  payload: Api4ComCallPayload,
): Promise<{ success: true; callId: string } | { error: string }> {
  const creds = getApi4ComCreds();
  if (!creds) return { error: "API4COM não configurado" };

  try {
    const resp = await fetch(`${creds.apiUrl}/calls`, {
      method: "POST",
      headers: {
        Authorization: creds.apiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[api4com] call error:", resp.status, text);
      return { error: `API4COM erro ${resp.status}` };
    }

    const data = (await resp.json()) as Api4ComCallResult;
    return { success: true, callId: data.id };
  } catch (err) {
    console.error("[api4com] call error:", err);
    return { error: "Falha ao conectar com API4COM" };
  }
}

const HANGUP_CAUSE_MAP: Record<string, StatusLigacao> = {
  NORMAL_CLEARING: "atendida",
  USER_BUSY: "ocupada",
  NO_ANSWER: "perdida",
  NO_USER_RESPONSE: "perdida",
  CALL_REJECTED: "rejeitada",
  ORIGINATOR_CANCEL: "cancelada",
  NORMAL_TEMPORARY_FAILURE: "cancelada",
  NORMAL_UNSPECIFIED: "perdida",
  UNALLOCATED_NUMBER: "cancelada",
  SUBSCRIBER_ABSENT: "perdida",
};

export function mapStatusApi4Com(
  hangupCause: string,
  duration: number,
): StatusLigacao {
  const mapped = HANGUP_CAUSE_MAP[hangupCause];
  if (mapped) {
    if (mapped === "atendida" && duration < 5) return "rejeitada";
    return mapped;
  }
  return duration > 0 ? "atendida" : "perdida";
}

export async function configurarWebhookApi4Com(
  webhookUrl: string,
): Promise<{ success: boolean; error?: string }> {
  const creds = getApi4ComCreds();
  if (!creds) return { success: false, error: "API4COM não configurado" };

  try {
    const resp = await fetch(`${creds.apiUrl}/integrations`, {
      method: "PATCH",
      headers: {
        Authorization: creds.apiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gateway: "yide-acompanha",
        webhook: true,
        webhookConstraint: {
          metadata: { gateway: "yide-acompanha" },
        },
        metadata: {
          webhookUrl,
          webhookVersion: "v1.4",
          webhookTypes: ["channel-hangup"],
        },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { success: false, error: text };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
