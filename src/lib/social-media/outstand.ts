// SERVER ONLY: do not import from client components
// Integração com Outstand (api.outstand.so) — usado pro Google Meu Negócio.
const OUTSTAND_BASE = "https://api.outstand.so/v1";

// Plataforma do Google no Outstand. Valor exato a confirmar no preview (chute: "google-business").
export const OUTSTAND_GOOGLE_PLATFORM = "google-business";

function getKey(): string | null {
  return process.env.OUTSTAND_API_KEY || null;
}

export interface OsResult<T> {
  data?: T;
  error?: string;
}

export interface OsAccount {
  id: string;
  platform: string;
  username?: string | null;
  external_id?: string | null;
}

export async function osFetch<T = unknown>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {},
): Promise<OsResult<T>> {
  const key = getKey();
  if (!key) return { error: "OUTSTAND_API_KEY não configurado no Vercel" };
  try {
    const res = await fetch(`${OUTSTAND_BASE}${path}`, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        (json?.error as string) || (json?.message as string) || `HTTP ${res.status}`;
      return { error: msg };
    }
    return { data: json as T };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro de rede (Outstand)" };
  }
}

/** Gera URL de OAuth pra conectar o Google Business (external_id = client_id). */
export async function gerarAuthUrlGoogle(externalId: string): Promise<OsResult<{ url: string }>> {
  return osFetch<{ url: string }>("/social-networks/auth-url", {
    method: "POST",
    body: { platform: OUTSTAND_GOOGLE_PLATFORM, external_id: externalId },
  });
}

/** Lista contas conectadas no Outstand. */
export async function listarContasOutstand(): Promise<OsResult<{ data: OsAccount[] }>> {
  return osFetch<{ data: OsAccount[] }>("/social-accounts");
}

/** Desconecta uma conta (best-effort). */
export async function desconectarContaOutstand(accountId: string): Promise<OsResult<unknown>> {
  return osFetch(`/social-accounts/${accountId}/disconnect`, { method: "POST" });
}

/** Publica no Google Business via Outstand. */
export async function publicarOutstand(args: {
  accountIds: string[];
  content: string;
  mediaUrls: string[];
}): Promise<OsResult<{ id: string }>> {
  if (args.accountIds.length === 0) return { error: "Sem contas conectadas" };
  return osFetch<{ id: string }>("/posts", {
    method: "POST",
    body: {
      containers: [{ content: args.content }],
      socialAccountIds: args.accountIds,
      media: args.mediaUrls.map((url) => ({ url })),
    },
  });
}
