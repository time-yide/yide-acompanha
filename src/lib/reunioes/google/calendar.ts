// Google Calendar API — STUBS pra Fase 1.
//
// Endpoint base: https://www.googleapis.com/calendar/v3
//
// Pra MVP a gente faz polling (cron a cada 5min) chamando `events.list`
// com `syncToken` pra incremental sync. Quando o usuário cria/edita/deleta
// um evento no Calendar, refletimos no Supabase como `meetings`.
//
// Mapeamento Calendar → meetings:
//   summary → titulo
//   description → descricao
//   start.dateTime → starts_at
//   end.dateTime → ends_at
//   conferenceData.entryPoints[uri] → external_url (se for meet.google.com)
//   attendees[] → meeting_participants
//   id → external_id
//   source = 'google_meet' se entryPoints contém meet.google.com
//
// Variáveis .env: usa GOOGLE_OAUTH_CLIENT_ID já configurado em oauth.ts.

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    organizer?: boolean;
    self?: boolean;
    responseStatus?: string;
  }>;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri: string }>;
  };
  hangoutLink?: string;
  status?: string;
}

/**
 * Lista eventos do calendário do usuário num intervalo.
 * @param accessToken Token Bearer
 * @param timeMin ISO
 * @param timeMax ISO
 */
export async function listEvents(
  _accessToken: string,
  _timeMin: string,
  _timeMax: string,
): Promise<GoogleCalendarEvent[]> {
  void _accessToken; void _timeMin; void _timeMax;
  throw new Error("Google Calendar API ainda não implementada (Fase 1 do roadmap).");
}

/**
 * Incremental sync usando syncToken (gravado em google_oauth_connections).
 * Quando o syncToken expira (410 Gone), refazemos full sync.
 */
export async function incrementalSync(
  _accessToken: string,
  _syncToken: string,
): Promise<{ events: GoogleCalendarEvent[]; nextSyncToken: string | null }> {
  void _accessToken; void _syncToken;
  throw new Error("Google Calendar incremental sync ainda não implementado (Fase 1 do roadmap).");
}

/**
 * Helper: extrai URL do Google Meet de um evento, se houver.
 */
export function getMeetUrl(event: GoogleCalendarEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const entry = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
  return entry?.uri ?? null;
}
