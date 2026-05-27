// SERVER ONLY — Helpers de upload/download/signed URLs pros buckets do Yori.

import { createServiceRoleClient } from "@/lib/supabase/service-role";

const BUCKET_VIDEOS = "yori-videos";
const BUCKET_OUTPUTS = "yori-outputs";

export function videoPath(orgId: string, userId: string, jobId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${orgId}/${userId}/${jobId}/${safeName}`;
}

export function outputPath(orgId: string, userId: string, jobId: string, type: "mp4" | "srt" | "txt"): string {
  const ext = type === "mp4" ? "mp4" : type;
  return `${orgId}/${userId}/${jobId}/output.${ext}`;
}

export async function uploadVideo(
  orgId: string,
  userId: string,
  jobId: string,
  filename: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const supabase = createServiceRoleClient();
  const path = videoPath(orgId, userId, jobId, filename);
  const { error } = await supabase.storage
    .from(BUCKET_VIDEOS)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

export async function uploadOutput(
  orgId: string,
  userId: string,
  jobId: string,
  type: "mp4" | "srt" | "txt",
  content: string | ArrayBuffer,
  contentType: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const supabase = createServiceRoleClient();
  const path = outputPath(orgId, userId, jobId, type);
  const { error } = await supabase.storage
    .from(BUCKET_OUTPUTS)
    .upload(path, content, { contentType, upsert: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

export async function getSignedUrl(
  bucket: "yori-videos" | "yori-outputs",
  path: string,
  expiresInSeconds: number = 3600,
): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function downloadFile(
  bucket: "yori-videos" | "yori-outputs",
  path: string,
): Promise<Buffer | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteFile(
  bucket: "yori-videos" | "yori-outputs",
  path: string,
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return !error;
}
