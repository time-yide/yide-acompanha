// SERVER ONLY: do not import from client components
const PFM_BASE = "https://api.postforme.dev/v1";

function getKey(): string | null {
  return process.env.POST_FOR_ME_API_KEY || null;
}

export interface PfmResult<T> {
  data?: T;
  error?: string;
}

export type PfmPlatform = "tiktok" | "youtube" | "linkedin" | "instagram" | "facebook";
export type PfmPlacement = "timeline" | "reels" | "stories";

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
  const body: Record<string, unknown> = {
    platform,
    external_id: externalId,
    // Permissão de publicar (padrão do Post for Me).
    permissions: ["posts"],
  };
  // Instagram exige o connection_type (igual o formulário do painel do Post for
  // Me). Sem ele, o link de OAuth vem incompleto e a aba abre em BRANCO.
  if (platform === "instagram") {
    body.platform_data = { instagram: { connection_type: "instagram" } };
  }
  // LinkedIn também exige connection_type. Como usamos as credenciais fornecidas
  // pelo Post for Me (app gerenciado, sem App Review), o valor tem que ser
  // "organization" — senão o link vem incompleto e a aba dá erro de página.
  if (platform === "linkedin") {
    body.platform_data = { linkedin: { connection_type: "organization" } };
  }
  return pfmFetch<{ url: string }>("/social-accounts/auth-url", {
    method: "POST",
    body,
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
  /** Placement pra Instagram/Facebook (feed=timeline, reels, stories). */
  placement?: PfmPlacement;
}): Promise<PfmResult<{ id: string }>> {
  if (args.accountIds.length === 0) return { error: "Sem contas conectadas" };
  const body: Record<string, unknown> = {
    caption: args.caption,
    social_accounts: args.accountIds,
    media: args.mediaUrls.map((url) => ({ url })),
  };
  // Stories/Reels precisam de placement explícito no IG/FB; feed é o default.
  if (args.placement && args.placement !== "timeline") {
    body.platform_configurations = {
      instagram: { placement: args.placement },
      facebook: { placement: args.placement },
    };
  }
  return pfmFetch<{ id: string }>("/social-posts", { method: "POST", body });
}
