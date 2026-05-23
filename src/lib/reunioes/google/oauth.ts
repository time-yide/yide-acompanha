// Google OAuth - STUBS pra Fase 1.
//
// Fluxo planejado:
// 1. Usuário clica "Conectar Google" → /reunioes/conectar
// 2. Server action `iniciarOAuth` retorna URL de authorize com state CSRF
// 3. Browser navega pra Google, user autoriza
// 4. Google redireciona pra /api/auth/google-callback?code=...&state=...
// 5. Handler troca code por tokens, salva em google_oauth_connections
// 6. Refresh automático antes do expires_at via worker / on-demand
//
// Scopes mínimos pro MVP:
//  - https://www.googleapis.com/auth/calendar.readonly (listar eventos)
//  - https://www.googleapis.com/auth/calendar.events.readonly (ver detalhes)
//
// Variáveis .env necessárias (NÃO commitar):
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_OAUTH_REDIRECT_URI=https://sistemaacompanha.yidedigital.com.br/api/auth/google-callback

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
}

/**
 * Gera URL de authorize do Google OAuth.
 * @param state Token CSRF (deve ser gerado e validado no callback).
 */
export function buildAuthorizeUrl(_state: string, _redirectUri: string): string {
  void _state; void _redirectUri;
  throw new Error("Google OAuth ainda não implementado (Fase 1 do roadmap). Veja docs/reunioes-roadmap.md");
}

/**
 * Troca o `code` recebido no callback por access/refresh tokens.
 */
export async function exchangeCodeForTokens(_code: string, _redirectUri: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  id_token: string;
}> {
  void _code; void _redirectUri;
  throw new Error("Google OAuth ainda não implementado (Fase 1 do roadmap).");
}

/**
 * Pega novo access_token usando refresh_token (chamado quando o atual expirou).
 */
export async function refreshAccessToken(_refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  void _refreshToken;
  throw new Error("Google OAuth ainda não implementado (Fase 1 do roadmap).");
}

/**
 * Retorna se o token expirou ou expira nos próximos 60s.
 */
export function isTokenExpiring(expiresAtIso: string, bufferSeconds = 60): boolean {
  return new Date(expiresAtIso).getTime() <= Date.now() + bufferSeconds * 1000;
}
