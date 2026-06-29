// SERVER ONLY: do not import from client components
const PFM_BASE = "https://api.postforme.dev/v1";

function getKey(): string | null {
  return process.env.POST_FOR_ME_API_KEY || null;
}

export interface PfmResult<T> {
  data?: T;
  error?: string;
}

export type PfmPlatform = "tiktok" | "youtube" | "linkedin";

export interface PfmAccount {
  id: string;
  platform: string;
  username?: string | null;
  external_id?: string | null;
}

export async function pfmFetch<T = unknown>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {},
): Promise<PfmResult<T>> {
  const key = getKey();
  if (!key) return { error: "POST_FOR_ME_API_KEY não configurado no Vercel" };
  try {
    const res = await fetch(`${PFM_BASE}${path}`, {
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
    return { error: err instanceof Error ? err.message : "Erro de rede (Post for Me)" };
  }
}

/** Gera URL de OAuth pra conectar uma conta da plataforma (external_id = client_id). */
export async function gerarAuthUrl(
  platform: PfmPlatform,
  externalId: string,
): Promise<PfmResult<{ url: string }>> {
  return pfmFetch<{ url: string }>("/social-accounts/auth-url", {
    method: "POST",
    body: { platform, external_id: externalId },
  });
}

/** Lista contas conectadas. */
export async function listarContas(): Promise<PfmResult<{ data: PfmAccount[] }>> {
  return pfmFetch<{ data: PfmAccount[] }>("/social-accounts");
}

/** Desconecta uma conta. */
export async function desconectarConta(accountId: string): Promise<PfmResult<unknown>> {
  return pfmFetch(`/social-accounts/${accountId}/disconnect`, { method: "POST" });
}

/** Publica nas contas dadas (uma chamada, várias contas). */
export async function publicarPostforme(args: {
  accountIds: string[];
  caption: string;
  mediaUrls: string[];
}): Promise<PfmResult<{ id: string }>> {
  if (args.accountIds.length === 0) return { error: "Sem contas conectadas" };
  return pfmFetch<{ id: string }>("/social-posts", {
    method: "POST",
    body: {
      caption: args.caption,
      social_accounts: args.accountIds,
      media: args.mediaUrls.map((url) => ({ url })),
    },
  });
}
