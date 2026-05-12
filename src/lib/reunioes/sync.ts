// Sync helper: pega eventos do Google Calendar e materializa em `meetings`.
//
// SERVER ONLY: usa service-role client.

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getValidAccessToken,
  type GoogleOAuthConnectionRow,
} from "./google/oauth";
import {
  type GoogleCalendarEvent,
  getMeetUrl,
  incrementalSync,
  isProcessableEvent,
  listEvents,
} from "./google/calendar";

/**
 * Janela default de full sync: 30 dias pra trás + 30 dias pra frente.
 * Pra reuniões mais antigas que isso, o user pode pedir "re-sync histórico"
 * (não implementado nesta fase).
 */
const HISTORICO_DIAS = 30;
const FUTURO_DIAS = 30;

interface SyncResult {
  /** Quantos eventos vieram do Google. */
  recebidos: number;
  /** Quantos foram materializados como `meetings` (processáveis = têm link Meet). */
  inseridos: number;
  /** Quantos eventos foram cancelados (status=cancelled) e refletidos. */
  cancelados: number;
  /** Quantos foram ignorados (sem link Meet, ou dia inteiro). */
  ignorados: number;
  /** True se syncToken expirou e fizemos full re-sync. */
  fullResync: boolean;
}

/**
 * Sincroniza eventos do Calendar pra `meetings` pra uma conexão.
 * Faz incremental se temos syncToken válido; senão full sync (janela default).
 *
 * Atualiza `calendar_sync_token` + `calendar_last_synced_at` ao fim.
 */
export async function syncMeetingsForConnection(
  conn: GoogleOAuthConnectionRow,
  organizationId: string,
): Promise<SyncResult> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Helper pra atualizar access_token no DB quando refreshamos.
  const persistRefreshedToken = async (id: string, accessToken: string, expiresAtIso: string) => {
    await sb
      .from("google_oauth_connections")
      .update({ access_token: accessToken, expires_at: expiresAtIso })
      .eq("id", id);
  };

  const accessToken = await getValidAccessToken(conn, persistRefreshedToken);

  let events: GoogleCalendarEvent[] = [];
  let nextSyncToken: string | null = null;
  let fullResync = false;

  if (conn.calendar_sync_token) {
    const r = await incrementalSync(accessToken, conn.calendar_sync_token);
    if (r.tokenExpired) {
      // syncToken expirou → full sync
      fullResync = true;
    } else {
      events = r.events;
      nextSyncToken = r.nextSyncToken;
    }
  } else {
    fullResync = true;
  }

  if (fullResync) {
    const now = Date.now();
    const timeMin = new Date(now - HISTORICO_DIAS * 86400_000).toISOString();
    const timeMax = new Date(now + FUTURO_DIAS * 86400_000).toISOString();
    const r = await listEvents(accessToken, timeMin, timeMax);
    events = r.events;
    nextSyncToken = r.nextSyncToken;
  }

  let inseridos = 0;
  let cancelados = 0;
  let ignorados = 0;

  for (const e of events) {
    // Cancelamentos: marca meeting como cancelled se existir
    if (e.status === "cancelled") {
      const { error } = await sb
        .from("meetings")
        .update({ status: "cancelled" })
        .eq("source", "google_meet")
        .eq("external_id", e.id);
      if (!error) cancelados++;
      continue;
    }

    if (!isProcessableEvent(e)) {
      ignorados++;
      continue;
    }

    const meetUrl = getMeetUrl(e);
    if (!meetUrl) {
      ignorados++;
      continue;
    }

    const startsAt = e.start.dateTime!;
    const endsAt = e.end.dateTime!;
    const durMs = new Date(endsAt).getTime() - new Date(startsAt).getTime();
    const duracaoSeg = durMs > 0 ? Math.floor(durMs / 1000) : null;

    // Reunião que já passou e veio do Calendar sem gravação ainda — status='scheduled'
    // até virar 'completed' quando o áudio for processado (Fase 2+).
    const { data: existingRow } = await sb
      .from("meetings")
      .select("id, status")
      .eq("source", "google_meet")
      .eq("external_id", e.id)
      .maybeSingle();

    const existing = existingRow as { id: string; status: string } | null;

    const meetingRow = {
      organization_id: organizationId,
      owner_user_id: conn.user_id,
      source: "google_meet" as const,
      // Se já existe e tá além de scheduled, mantém status (não regredir).
      status: existing && existing.status !== "scheduled" ? existing.status : "scheduled",
      external_id: e.id,
      external_url: meetUrl,
      titulo: e.summary || "Reunião sem título",
      descricao: e.description ?? null,
      starts_at: startsAt,
      ends_at: endsAt,
      duracao_segundos: existing?.status === "completed" ? undefined : duracaoSeg,
      idioma: "pt-BR",
    };

    if (existing) {
      const { error } = await sb
        .from("meetings")
        .update(meetingRow)
        .eq("id", existing.id);
      if (!error) inseridos++;
    } else {
      const { data: inserted, error } = await sb
        .from("meetings")
        .insert(meetingRow)
        .select("id")
        .single();
      if (!error && inserted) {
        inseridos++;
        // Materializa participantes (attendees do Google)
        if (e.attendees && e.attendees.length > 0) {
          const partRows = e.attendees
            .filter((a) => a.email)
            .map((a) => ({
              meeting_id: inserted.id,
              nome: a.displayName ?? a.email,
              email: a.email,
              papel: a.organizer ? "host" : "attendee",
            }));
          if (partRows.length > 0) {
            await sb.from("meeting_participants").insert(partRows);
          }
        }
      }
    }
  }

  // Atualiza sync state na conexão
  await sb
    .from("google_oauth_connections")
    .update({
      calendar_sync_token: nextSyncToken,
      calendar_last_synced_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  return { recebidos: events.length, inseridos, cancelados, ignorados, fullResync };
}

/**
 * Pega conexão ativa do user atual. Retorna null se não tem.
 */
export async function getActiveConnection(
  userId: string,
): Promise<GoogleOAuthConnectionRow | null> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("google_oauth_connections")
    .select("id, user_id, google_email, access_token, refresh_token, expires_at, scopes, ativa, calendar_sync_token, calendar_last_synced_at")
    .eq("user_id", userId)
    .eq("ativa", true)
    .maybeSingle();
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("schema cache") || msg.includes("does not exist")) {
      return null;
    }
    throw error;
  }
  return (data as GoogleOAuthConnectionRow | null) ?? null;
}
