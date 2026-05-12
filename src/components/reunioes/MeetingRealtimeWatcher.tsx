"use client";

import { useRealtimeRefresh } from "@/lib/supabase/use-realtime-refresh";

interface Props {
  meetingId: string;
}

/**
 * Headless: ouve mudanças nas tabelas relevantes pra UMA reunião e dispara
 * router.refresh() automaticamente. Tabelas escutadas:
 *  - meetings (status, flags ready, retencao_override)
 *  - meeting_transcripts (quando Whisper terminar)
 *  - meeting_summaries (quando Claude terminar)
 *  - meeting_extracted_tasks (quando tasks forem geradas/aceitas)
 *
 * Filtra pelo meeting_id pra não receber tráfego de outras reuniões.
 */
export function MeetingRealtimeWatcher({ meetingId }: Props) {
  // Filter PostgREST: pra meetings é id=eq.X, pras outras é meeting_id=eq.X
  useRealtimeRefresh(`meeting-${meetingId}`, "meetings", `id=eq.${meetingId}`);
  useRealtimeRefresh(
    `meeting-transcripts-${meetingId}`,
    "meeting_transcripts",
    `meeting_id=eq.${meetingId}`,
  );
  useRealtimeRefresh(
    `meeting-summaries-${meetingId}`,
    "meeting_summaries",
    `meeting_id=eq.${meetingId}`,
  );
  useRealtimeRefresh(
    `meeting-tasks-${meetingId}`,
    "meeting_extracted_tasks",
    `meeting_id=eq.${meetingId}`,
  );

  return null;
}
