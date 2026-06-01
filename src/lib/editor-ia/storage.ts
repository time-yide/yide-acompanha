// SERVER ONLY — storage do Editor IA (bucket unico 'editor-ia').
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const BUCKET = "editor-ia";

export function videoPath(orgId: string, userId: string, jobId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${orgId}/${userId}/${jobId}/${safe}`;
}

export function outputPath(orgId: string, userId: string, jobId: string): string {
  return `${orgId}/${userId}/${jobId}/output.mp4`;
}

export async function uploadVideo(
  orgId: string,
  userId: string,
  jobId: string,
  filename: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const sb = createServiceRoleClient();
  const path = videoPath(orgId, userId, jobId, filename);
  const { error } = await sb.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

export async function downloadFile(path: string): Promise<Buffer | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function createSignedUpload(
  orgId: string,
  userId: string,
  jobId: string,
  filename: string,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  const sb = createServiceRoleClient();
  const path = videoPath(orgId, userId, jobId, filename);
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao gerar upload" };
  return { ok: true, path, token: data.token };
}

export async function uploadOutput(
  path: string,
  content: string | ArrayBuffer,
  contentType: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const sb = createServiceRoleClient();
  const { error } = await sb.storage.from(BUCKET).upload(path, content, { contentType, upsert: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}
