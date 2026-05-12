// Google Calendar API — Fase 1.
//
// Endpoint base: https://www.googleapis.com/calendar/v3
//
// Estratégia: polling via cron a cada 5min. Pra cada user conectado:
//  - Se temos syncToken: chama events.list com syncToken (incremental).
//  - Se NÃO temos (primeira sync ou token expirou): full sync nos últimos
//    30 dias + próximos 30 dias.
//
// Mapeamento Calendar → meetings:
//   summary             → titulo
//   description         → descricao
//   start.dateTime      → starts_at
//   end.dateTime        → ends_at
//   conferenceData.uri  → external_url
//   id                  → external_id (com source='google_meet')
//   status='cancelled'  → meeting status = 'cancelled'
//
// Filtramos: só guardamos eventos que TÊM Google Meet link. Reuniões só
// presenciais ou via outras ferramentas não entram nesse módulo.

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
  organizer?: { email?: string; displayName?: string; self?: boolean };
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri: string; label?: string }>;
  };
  hangoutLink?: string;
  htmlLink?: string;
  status?: string;
}

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/**
 * Lista eventos do calendário primário do user no intervalo dado.
 * Pagina automaticamente (`pageToken`) até pegar tudo.
 */
export async function listEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<{ events: GoogleCalendarEvent[]; nextSyncToken: string | null }> {
  const all: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const url = new URL(CALENDAR_BASE);
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");
    url.searchParams.set("showDeleted", "false");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(`Calendar events.list falhou (${r.status}): ${body}`);
    }
    const data = (await r.json()) as {
      items?: GoogleCalendarEvent[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };
    if (data.items) all.push(...data.items);
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { events: all, nextSyncToken };
}

/**
 * Incremental sync usando syncToken. Quando expira (410 Gone), retorna
 * `nextSyncToken: null` — caller deve refazer full sync.
 */
export async function incrementalSync(
  accessToken: string,
  syncToken: string,
): Promise<{ events: GoogleCalendarEvent[]; nextSyncToken: string | null; tokenExpired: boolean }> {
  const all: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;
  let tokenExpired = false;
  let firstCallToken: string | undefined = syncToken;

  do {
    const url = new URL(CALENDAR_BASE);
    // syncToken e pageToken são mutuamente exclusivos
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    } else {
      url.searchParams.set("syncToken", firstCallToken!);
    }
    firstCallToken = undefined;

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (r.status === 410) {
      // syncToken expirou — caller refaz full sync
      tokenExpired = true;
      break;
    }
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(`Calendar incrementalSync falhou (${r.status}): ${body}`);
    }
    const data = (await r.json()) as {
      items?: GoogleCalendarEvent[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };
    if (data.items) all.push(...data.items);
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { events: all, nextSyncToken, tokenExpired };
}

/**
 * Extrai URL do Google Meet de um evento. Retorna null se não for evento Meet.
 */
export function getMeetUrl(event: GoogleCalendarEvent): string | null {
  if (event.hangoutLink && event.hangoutLink.includes("meet.google.com")) {
    return event.hangoutLink;
  }
  const entry = event.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video" && e.uri.includes("meet.google.com"),
  );
  return entry?.uri ?? null;
}

/**
 * Considera só eventos válidos pra criar `meetings`. Filtra:
 *  - Sem dateTime (eventos de dia inteiro)
 *  - Sem link de Meet
 *  - Cancelados (esses viram update de status, não delete)
 */
export function isProcessableEvent(event: GoogleCalendarEvent): boolean {
  if (!event.start.dateTime || !event.end.dateTime) return false;
  if (event.status === "cancelled") return false;
  return getMeetUrl(event) !== null;
}
