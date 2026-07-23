// SERVER ONLY — storage das gravações de reunião (bucket meeting-recordings).
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const BUCKET = "meeting-recordings";

export function recordingPath(orgId: string, clientId: string, meetingId: string, ext: string): string {
  const safeExt = (ext || "webm").toLowerCase().replace(/[^a-z0-9]/g, "") || "webm";
  return `${orgId}/${clientId}/${meetingId}/audio.${safeExt}`;
}

/** Gera URL assinada de upload (browser sobe direto via uploadToSignedUrl). */
export async function createSignedUpload(
  path: string,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao gerar upload" };
  return { ok: true, path, token: data.token };
}

/** URL assinada pra tocar o áudio (privado). */
export async function getSignedPlaybackUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function removeRecording(path: string): Promise<void> {
  const sb = createServiceRoleClient();
  await sb.storage.from(BUCKET).remove([path]);
}
