// SERVER ONLY
import "server-only";
import { createSign } from "node:crypto";

/**
 * Token OAuth da conta de serviço (a mesma do ads-manager) pra ler GA4,
 * Search Console e Analytics Admin. Env: GOOGLE_SERVICE_ACCOUNT_JSON (JSON inteiro).
 */
export const SCOPES_DADOS = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

export interface ServiceAccount { clientEmail: string; privateKey: string }

export function lerServiceAccount(raw: string | undefined = process.env.GOOGLE_SERVICE_ACCOUNT_JSON): ServiceAccount | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!j.client_email || !j.private_key) return null;
    return { clientEmail: j.client_email, privateKey: j.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

export function montarAssertion(sa: ServiceAccount, scopes: string[], agoraSeg = Math.floor(Date.now() / 1000)): string {
  const head = b64({ alg: "RS256", typ: "JWT" });
  const body = b64({ iss: sa.clientEmail, scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token", iat: agoraSeg, exp: agoraSeg + 3600 });
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(sa.privateKey).toString("base64url");
  return `${head}.${body}.${sig}`;
}

let cache: { token: string; expira: number } | null = null;

/** null = conta de serviço não configurada ou falha na troca. Cache em memória ~55min. */
export async function getGoogleToken(): Promise<string | null> {
  if (cache && cache.expira > Date.now()) return cache.token;
  const sa = lerServiceAccount();
  if (!sa) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: montarAssertion(sa, SCOPES_DADOS) }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.error("[dados/google-auth] token HTTP", res.status); return null; }
    const j = (await res.json()) as { access_token: string; expires_in: number };
    cache = { token: j.access_token, expira: Date.now() + (j.expires_in - 300) * 1000 };
    return j.access_token;
  } catch (e) {
    console.error("[dados/google-auth]", e);
    return null;
  }
}

export function emailContaServico(): string | null {
  return lerServiceAccount()?.clientEmail ?? null;
}
