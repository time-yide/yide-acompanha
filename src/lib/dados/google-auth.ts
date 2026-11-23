// SERVER ONLY
import "server-only";
import { createSign } from "node:crypto";

/**
 * Token OAuth da conta de serviço (a mesma do ads-manager) pra ler GA4,
 * Search Console e Analytics Admin (e, com SCOPES_ADMIN, criar GA4 / verificar Search Console). Env: GOOGLE_SERVICE_ACCOUNT_JSON (JSON inteiro).
 */
export const SCOPES_DADOS = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

/** Escrita: criar propriedade GA4, gerar/verificar TXT de DNS e adicionar site no Search Console. */
export const SCOPES_ADMIN = [
  "https://www.googleapis.com/auth/analytics.edit",
  "https://www.googleapis.com/auth/siteverification",
  "https://www.googleapis.com/auth/webmasters",
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

/** Cache por conjunto de escopos (chave = escopos unidos por espaço). */
const cache = new Map<string, { token: string; expira: number }>();
const emVoo = new Map<string, Promise<string | null>>();

/** Chave do cache/single-flight de um conjunto de escopos. */
export const chaveEscopos = (scopes: string[]) => scopes.join(" ");

/** null = conta de serviço não configurada ou falha na troca. Cache em memória ~55min por escopo; 1 troca por vez por escopo. */
export async function getGoogleToken(scopes: string[] = SCOPES_DADOS): Promise<string | null> {
  const chave = chaveEscopos(scopes);
  const c = cache.get(chave);
  if (c && c.expira > Date.now()) return c.token;
  let p = emVoo.get(chave);
  if (!p) {
    p = trocarToken(scopes).finally(() => { emVoo.delete(chave); });
    emVoo.set(chave, p);
  }
  return p;
}

async function trocarToken(scopes: string[]): Promise<string | null> {
  const sa = lerServiceAccount();
  if (!sa) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: montarAssertion(sa, scopes) }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.error("[dados/google-auth] token HTTP", res.status); return null; }
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token || !j.expires_in) { console.error("[dados/google-auth] resposta sem token"); return null; }
    cache.set(chaveEscopos(scopes), { token: j.access_token, expira: Date.now() + (j.expires_in - 300) * 1000 });
    return j.access_token;
  } catch (e) {
    console.error("[dados/google-auth]", e);
    return null;
  }
}

export function emailContaServico(): string | null {
  return lerServiceAccount()?.clientEmail ?? null;
}
