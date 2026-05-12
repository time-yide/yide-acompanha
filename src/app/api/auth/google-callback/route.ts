import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";
import {
  exchangeCodeForTokens,
  getRedirectUri,
  getUserInfo,
} from "@/lib/reunioes/google/oauth";

const STATE_COOKIE = "yide_google_oauth_state";

/**
 * Callback do Google OAuth.
 * URL: ${NEXT_PUBLIC_APP_URL}/api/auth/google-callback?code=...&state=...
 *
 * Fluxo:
 *  1. Valida CSRF state (cookie vs query param)
 *  2. Troca code por tokens via Google
 *  3. Pega email do user via /userinfo
 *  4. Upserta em google_oauth_connections (1 conexão por user)
 *  5. Limpa cookie de state
 *  6. Redireciona pra /reunioes/conectar?status=connected
 *
 * Se algo falhar, redireciona pra /reunioes/conectar?error=<código>.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // Google pode mandar ?error= se o user negou
  if (errorParam) {
    return redirectError(url, errorParam);
  }
  if (!code || !state) {
    return redirectError(url, "missing_params");
  }

  // Valida CSRF
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  if (!expectedState || state !== expectedState) {
    return redirectError(url, "invalid_state");
  }

  // User precisa estar logado pra completar o flow
  let user;
  try {
    user = await requireAuth();
  } catch {
    return redirectError(url, "not_authenticated");
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, getRedirectUri());
  } catch (e) {
    console.error("[google-oauth-callback] token exchange failed:", e);
    return redirectError(url, "token_exchange_failed");
  }

  if (!tokens.refresh_token) {
    // Sem refresh_token a conexão é inútil (não dá pra renovar quando expira em 1h).
    // prompt=consent garante que sempre venha — se não veio, algo tá errado na config.
    return redirectError(url, "no_refresh_token");
  }

  let userInfo;
  try {
    userInfo = await getUserInfo(tokens.access_token);
  } catch (e) {
    console.error("[google-oauth-callback] userinfo failed:", e);
    return redirectError(url, "userinfo_failed");
  }

  // Pega organization_id do profile
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profileRow } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = (profileRow as { organization_id?: string } | null)?.organization_id;
  if (!orgId) {
    return redirectError(url, "no_organization");
  }

  const expiresAtIso = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const scopes = tokens.scope.split(" ").filter(Boolean);

  const { error: upsertError } = await sb
    .from("google_oauth_connections")
    .upsert(
      {
        organization_id: orgId,
        user_id: user.id,
        google_email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAtIso,
        scopes,
        ativa: true,
        calendar_sync_token: null,
        calendar_last_synced_at: null,
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    // Se a tabela ainda não foi criada (migration não aplicada), avisa explícito
    const msg = upsertError.message ?? "";
    if (msg.includes("schema cache") || msg.includes("does not exist")) {
      return redirectError(url, "migration_pending");
    }
    console.error("[google-oauth-callback] upsert failed:", upsertError);
    return redirectError(url, "db_upsert_failed");
  }

  await logAudit({
    entidade: "google_oauth_connections",
    entidade_id: user.id,
    acao: "create",
    dados_depois: { google_email: userInfo.email, scopes },
    ator_id: user.id,
    justificativa: "Conexão Google OAuth iniciada pelo user",
  });

  const successUrl = new URL("/reunioes/conectar?status=connected", url);
  return NextResponse.redirect(successUrl);
}

function redirectError(url: URL, code: string) {
  const target = new URL(`/reunioes/conectar?error=${encodeURIComponent(code)}`, url);
  return NextResponse.redirect(target);
}
