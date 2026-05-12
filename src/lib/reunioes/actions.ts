"use server";

import { cookies } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { buildAuthorizeUrl, getRedirectUri, revokeToken } from "./google/oauth";
import { MEETINGS_CACHE_TAG } from "./queries";

const STATE_COOKIE = "yide_google_oauth_state";

/**
 * Gera URL de authorize do Google + grava state CSRF em cookie HTTP-only.
 * Cliente navega pra essa URL e Google redireciona pro /api/auth/google-callback.
 */
export async function iniciarGoogleOAuthAction(): Promise<
  | { url: string }
  | { error: string }
> {
  await requireAuth();
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return { error: "Credenciais Google não configuradas no servidor. Avise o admin." };
  }

  // crypto.randomUUID é cripto-seguro o suficiente pra CSRF state.
  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10min — flow OAuth deveria ser bem mais rápido que isso
  });

  let redirectUri: string;
  try {
    redirectUri = getRedirectUri();
  } catch (e) {
    return { error: (e as Error).message };
  }

  return { url: buildAuthorizeUrl(state, redirectUri) };
}

/**
 * Revoga conexão Google do user atual:
 *  1. Pega tokens no DB
 *  2. Chama revoke endpoint no Google (best-effort)
 *  3. Deleta linha em google_oauth_connections
 *
 * NÃO deleta meetings já sincronizadas — usuário pode querer manter o histórico.
 */
export async function revogarGoogleOAuthAction(): Promise<
  | { success: true }
  | { error: string }
> {
  const user = await requireAuth();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: conn } = await sb
    .from("google_oauth_connections")
    .select("id, access_token, refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!conn) return { error: "Conexão não encontrada" };

  // Best-effort revoke no Google
  await revokeToken(conn.access_token).catch(() => null);
  await revokeToken(conn.refresh_token).catch(() => null);

  const { error } = await sb
    .from("google_oauth_connections")
    .delete()
    .eq("id", conn.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "google_oauth_connections",
    entidade_id: conn.id,
    acao: "delete",
    ator_id: user.id,
    justificativa: "Desconexão pelo próprio user",
  });

  revalidatePath("/reunioes");
  revalidatePath("/reunioes/conectar");
  revalidateTag(MEETINGS_CACHE_TAG, "default");
  return { success: true };
}
