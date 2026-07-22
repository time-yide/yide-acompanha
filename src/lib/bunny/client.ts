import { createHash } from "node:crypto";
import { getServerEnv } from "@/lib/env";

const BASE = "https://video.bunnycdn.com";

function creds() {
  const env = getServerEnv();
  if (!env.BUNNY_STREAM_API_KEY || !env.BUNNY_STREAM_LIBRARY_ID || !env.BUNNY_STREAM_CDN_HOSTNAME) {
    throw new Error("BUNNY_NAO_CONFIGURADO");
  }
  return {
    apiKey: env.BUNNY_STREAM_API_KEY,
    libraryId: env.BUNNY_STREAM_LIBRARY_ID,
    cdn: env.BUNNY_STREAM_CDN_HOSTNAME,
  };
}

/** Cria um vídeo (vazio) no Bunny e devolve o GUID. */
export async function criarVideo(titulo: string): Promise<string> {
  const { apiKey, libraryId } = creds();
  const resp = await fetch(`${BASE}/library/${libraryId}/videos`, {
    method: "POST",
    headers: { AccessKey: apiKey, "content-type": "application/json" },
    body: JSON.stringify({ title: titulo }),
  });
  if (!resp.ok) throw new Error(`BUNNY_CRIAR_FALHOU:${resp.status}`);
  const data = (await resp.json()) as { guid: string };
  return data.guid;
}

export interface UploadTus {
  endpoint: string;
  libraryId: string;
  videoId: string;
  signature: string;
  expiration: number;
}

/** Gera os parâmetros de upload TUS assinados pro browser enviar direto ao Bunny. */
export function assinaturaUpload(videoId: string): UploadTus {
  const { apiKey, libraryId } = creds();
  // expira em 2h
  const expiration = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
  const signature = createHash("sha256")
    .update(libraryId + apiKey + expiration + videoId)
    .digest("hex");
  return { endpoint: `${BASE}/tusupload`, libraryId, videoId, signature, expiration };
}

/** Status do vídeo (4 = pronto pra tocar). */
export async function statusVideo(videoId: string): Promise<{ pronto: boolean; duracaoSeg: number }> {
  const { apiKey, libraryId } = creds();
  const resp = await fetch(`${BASE}/library/${libraryId}/videos/${videoId}`, {
    headers: { AccessKey: apiKey },
  });
  if (!resp.ok) throw new Error(`BUNNY_STATUS_FALHOU:${resp.status}`);
  const data = (await resp.json()) as { status: number; length: number };
  return { pronto: data.status >= 4, duracaoSeg: Math.round(data.length ?? 0) };
}

/** true se as envs do Bunny estão setadas. Não lança. */
export function bunnyConfigurado(): boolean {
  try { creds(); return true; } catch { return false; }
}

/** URL do player HLS. String vazia se o Bunny não está configurado (sem lançar). */
export function urlPlaylist(videoId: string): string {
  if (!bunnyConfigurado()) return "";
  return `https://${creds().cdn}/${videoId}/playlist.m3u8`;
}
/** URL da miniatura. String vazia se o Bunny não está configurado (sem lançar). */
export function urlThumbnail(videoId: string): string {
  if (!bunnyConfigurado()) return "";
  return `https://${creds().cdn}/${videoId}/thumbnail.jpg`;
}
