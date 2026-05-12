// Google OAuth — Fase 1.
//
// Fluxo:
// 1. Usuário clica "Conectar Google" → server action `iniciarOAuthAction` gera state CSRF,
//    salva em cookie e retorna URL de authorize.
// 2. Browser navega pra Google.
// 3. Google redireciona pra /api/auth/google-callback?code=...&state=...
// 4. Handler valida state, troca code por tokens, salva em google_oauth_connections.
// 5. Refresh automático on-demand (quando token expira em <60s).
//
// Variáveis .env necessárias:
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   NEXT_PUBLIC_APP_URL (já existe — usado pra montar redirect_uri)
//
// Configurar no Google Cloud Console:
//   https://console.cloud.google.com/apis/credentials
//   - Criar OAuth Client ID tipo "Web application"
//   - Authorized redirect URIs: ${NEXT_PUBLIC_APP_URL}/api/auth/google-callback
//   - Habilitar APIs: Google Calendar API

export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "openid",
  "email",
  "profile",
] as const;

export interface GoogleOAuthConnectionRow {
  id: string;
  user_id: string;
  google_email: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string[];
  ativa: boolean;
  calendar_sync_token: string | null;
  calendar_last_synced_at: string | null;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
  token_type: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

/**
 * URL de redirect — montada a partir de NEXT_PUBLIC_APP_URL pra funcionar
 * tanto em local (http://localhost:3000) quanto em prod (sistemaacompanha.yidedigital.com.br).
 */
export function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL não configurada");
  return `${base}/api/auth/google-callback`;
}

/**
 * Gera URL de authorize do Google OAuth.
 * @param state Token CSRF (deve ser gerado e salvo em cookie HTTP-only).
 */
export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID não configurada");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    access_type: "offline", // pede refresh_token
    prompt: "consent",      // força reconsentimento — garante refresh_token vir mesmo em re-conexão
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Troca o `code` recebido no callback por access/refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET não configuradas");
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Google token exchange falhou (${r.status}): ${body}`);
  }
  return r.json() as Promise<GoogleTokenResponse>;
}

/**
 * Pega novo access_token usando refresh_token (chamado quando o atual expirou).
 * Note: Google NÃO retorna novo refresh_token aqui — sempre reusar o original.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET não configuradas");
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Google token refresh falhou (${r.status}): ${body}`);
  }
  const data = (await r.json()) as { access_token: string; expires_in: number };
  return data;
}

/**
 * Revoga o token no Google. Usado quando o user desconecta.
 */
export async function revokeToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
  }).catch(() => {
    // Best-effort: se Google estiver fora, deletamos a conexão localmente
    // de qualquer jeito.
  });
}

/**
 * Pega info básica do user (email, nome) pra associar a conexão à conta interna.
 */
export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Google userinfo falhou (${r.status}): ${body}`);
  }
  return r.json() as Promise<GoogleUserInfo>;
}

/**
 * Retorna se o token expirou ou expira nos próximos 60s.
 */
export function isTokenExpiring(expiresAtIso: string, bufferSeconds = 60): boolean {
  return new Date(expiresAtIso).getTime() <= Date.now() + bufferSeconds * 1000;
}

/**
 * Pega access_token válido pra uma conexão. Refresha automaticamente se necessário,
 * atualiza o DB e retorna o token novo.
 *
 * IMPORTANTE: chamar essa função em vez de usar `connection.access_token` direto
 * em qualquer call pro Google.
 */
export async function getValidAccessToken(
  connection: Pick<GoogleOAuthConnectionRow, "id" | "access_token" | "refresh_token" | "expires_at">,
  /** Função pra persistir o token refreshado. Recebe (id, accessToken, expiresAtIso). */
  persistFn: (id: string, accessToken: string, expiresAtIso: string) => Promise<void>,
): Promise<string> {
  if (!isTokenExpiring(connection.expires_at)) {
    return connection.access_token;
  }
  const refreshed = await refreshAccessToken(connection.refresh_token);
  const expiresAtIso = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await persistFn(connection.id, refreshed.access_token, expiresAtIso);
  return refreshed.access_token;
}
