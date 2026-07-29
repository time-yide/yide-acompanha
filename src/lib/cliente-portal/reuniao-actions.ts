"use server";

import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSignedPlaybackUrl } from "@/lib/reunioes/storage";

type Res<T> = T | { error: string };

/**
 * URL assinada da gravação para o PORTAL DO CLIENTE. Só devolve se a reunião é
 * do cliente logado E está liberada (visivel_cliente) — o gate de permissão é
 * do lado do cliente, distinto do urlAudioReuniaoAction interno.
 */
export async function urlAudioReuniaoClienteAction(meetingId: string): Promise<Res<{ url: string }>> {
  const user = await requireClientPortalAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: mt } = await sb
    .from("meetings")
    .select("id")
    .eq("id", meetingId)
    .eq("client_id", user.clientId)
    .eq("visivel_cliente", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!mt) return { error: "Sem acesso" };
  const { data: rec } = await sb
    .from("meeting_recordings")
    .select("audio_url")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!rec?.audio_url) return { error: "Sem gravação" };
  const url = await getSignedPlaybackUrl(rec.audio_url, 6 * 60 * 60);
  if (!url) return { error: "Falha ao gerar link" };
  return { url };
}
