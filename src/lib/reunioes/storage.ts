// Helpers de Supabase Storage pra gravações de reunião.
// SERVER ONLY.
//
// Path convention: {organization_id}/{meeting_id}/{filename}
// O bucket é privado — leitura via signed URL com TTL.

import { createServiceRoleClient } from "@/lib/supabase/service-role";

const BUCKET = "meeting-recordings";

/** TTL default da signed URL de leitura (1 hora — suficiente pra Whisper baixar). */
const READ_URL_TTL_SECONDS = 3600;

/** TTL default da signed upload URL (5 min — flow de upload é rápido). */
const UPLOAD_URL_TTL_SECONDS = 300;

/** Tipos MIME aceitos — espelha o constraint do bucket. */
export const ALLOWED_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "video/mp4",
  "video/webm",
] as const;

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

/** Whisper API limita 25MB. Avisamos client-side antes de tentar upload. */
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Sanitiza nome de arquivo: remove caracteres especiais, mantém extensão.
 */
export function sanitizeFilename(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const ext = lastDot > 0 ? name.slice(lastDot) : "";
  const base = (lastDot > 0 ? name.slice(0, lastDot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 60);
  return `${base || "audio"}${ext}`;
}

/**
 * Monta path canônico pro arquivo no bucket.
 */
export function buildRecordingPath(
  organizationId: string,
  meetingId: string,
  filename: string,
): string {
  const cleanName = sanitizeFilename(filename);
  const timestamp = Date.now();
  return `${organizationId}/${meetingId}/${timestamp}-${cleanName}`;
}

/**
 * Gera signed upload URL pro client mandar arquivo direto pro Supabase
 * (sem passar pelo servidor Next.js, evita limite de 4.5MB).
 *
 * Cliente faz: `fetch(url, { method: 'PUT', body: file })`.
 */
export async function createSignedUploadUrl(path: string): Promise<{
  url: string;
  token: string;
  path: string;
}> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: false });

  if (error) throw new Error(`Falha ao criar signed upload URL: ${error.message}`);
  void UPLOAD_URL_TTL_SECONDS; // TTL é gerenciado pelo Supabase (~2h default)
  return { url: data.signedUrl, token: data.token, path: data.path };
}

/**
 * Gera signed read URL pra Whisper baixar o áudio.
 * TTL curto (1h) é suficiente — Whisper baixa em segundos.
 */
export async function createSignedReadUrl(path: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, READ_URL_TTL_SECONDS);
  if (error) throw new Error(`Falha ao criar signed read URL: ${error.message}`);
  return data.signedUrl;
}

/**
 * Deleta arquivo do bucket. Idempotente.
 */
export async function deleteRecording(path: string): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.storage.from(BUCKET).remove([path]).catch(() => null);
}

/**
 * Pega metadata (tamanho) sem baixar. Útil depois do upload do client
 * pra preencher size_bytes em meeting_recordings.
 */
export async function getRecordingMetadata(path: string): Promise<{
  size: number;
  contentType: string | null;
} | null> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase.storage.from(BUCKET) as any;
  const lastSlash = path.lastIndexOf("/");
  const dir = lastSlash >= 0 ? path.slice(0, lastSlash) : "";
  const filename = path.slice(lastSlash + 1);

  const { data, error } = await sb.list(dir, {
    limit: 100,
    search: filename,
  });
  if (error || !data) return null;
  const found = (data as Array<{ name: string; metadata?: { size?: number; mimetype?: string } }>).find(
    (f) => f.name === filename,
  );
  if (!found) return null;
  return {
    size: found.metadata?.size ?? 0,
    contentType: found.metadata?.mimetype ?? null,
  };
}
