import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { syncMeetingsForConnection } from "@/lib/reunioes/sync";
import { MEETINGS_CACHE_TAG } from "@/lib/reunioes/queries";
import type { GoogleOAuthConnectionRow } from "@/lib/reunioes/google/oauth";

/**
 * Cron: sincroniza Google Calendar pra todas as conexões ativas.
 *
 * Vercel cron schedule sugerido: every 5 minutes
 * Em vercel.json:
 * {
 *   "crons": [
 *     { "path": "/api/cron/sync-google-calendar", "schedule": "*\/5 * * * *" }
 *   ]
 * }
 *
 * Autenticação: CRON_SECRET via header Authorization: Bearer <secret>
 * (Vercel Cron envia esse header automaticamente quando CRON_SECRET está
 * configurado nas env vars do projeto).
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Pega todas as conexões ativas. Cada uma é processada em série pra evitar
  // 429 do Google (em escala maior, mover pra fila). Volume esperado: <20 users.
  const { data: connsData, error: connsError } = await sb
    .from("google_oauth_connections")
    .select("id, user_id, organization_id, google_email, access_token, refresh_token, expires_at, scopes, ativa, calendar_sync_token, calendar_last_synced_at")
    .eq("ativa", true);

  if (connsError) {
    const msg = connsError.message ?? "";
    if (msg.includes("schema cache") || msg.includes("does not exist")) {
      // Migration ainda não foi aplicada — sai com sucesso pra não floodar logs
      return NextResponse.json({ skipped: "migration_pending" });
    }
    return NextResponse.json({ error: connsError.message }, { status: 500 });
  }

  const conns = (connsData ?? []) as Array<GoogleOAuthConnectionRow & { organization_id: string }>;

  const resultados: Array<{
    user_id: string;
    ok: boolean;
    recebidos?: number;
    inseridos?: number;
    cancelados?: number;
    ignorados?: number;
    fullResync?: boolean;
    error?: string;
  }> = [];

  for (const conn of conns) {
    try {
      const r = await syncMeetingsForConnection(conn, conn.organization_id);
      resultados.push({ user_id: conn.user_id, ok: true, ...r });
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      resultados.push({ user_id: conn.user_id, ok: false, error: msg });
      console.error(`[cron sync-google-calendar] user=${conn.user_id}:`, msg);
    }
  }

  if (resultados.some((r) => r.ok && (r.inseridos ?? 0) > 0)) {
    revalidateTag(MEETINGS_CACHE_TAG, "default");
  }

  return NextResponse.json({ synced: resultados.length, resultados });
}
