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

/**
 * Re-encoda o vídeo no Bunny, regenerando as renditions com as CONFIGS ATUAIS
 * da library (incluindo MP4 Fallback). Serve pra gerar o MP4 de download de
 * vídeos antigos, encodados ANTES do MP4 Fallback estar ligado. Leva alguns
 * minutos pra concluir. Retorna true se o Bunny aceitou o pedido.
 */
export async function reencodeVideo(videoId: string): Promise<boolean> {
  if (!bunnyConfigurado() || !videoId) return false;
  const { apiKey, libraryId } = creds();
  const resp = await fetch(`${BASE}/library/${libraryId}/videos/${videoId}/reencode`, {
    method: "POST",
    headers: { AccessKey: apiKey },
  });
  return resp.ok;
}

/** Deleta um vídeo no Bunny (best-effort — não lança se falhar/inexistir). */
export async function deletarVideo(videoId: string): Promise<void> {
  if (!bunnyConfigurado() || !videoId) return;
  try {
    const { apiKey, libraryId } = creds();
    await fetch(`${BASE}/library/${libraryId}/videos/${videoId}`, {
      method: "DELETE",
      headers: { AccessKey: apiKey },
    });
  } catch {
    // best-effort: o registro no banco já será removido de qualquer forma
  }
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

/**
 * Status do vídeo no Bunny.
 * Códigos: 0-3 processando, 4 finished (ok), 5 error, 6 upload failed,
 * 7/8 JIT (já playável).
 *
 * BUG antigo: `status >= 4` marcava ERROR (5) e UPLOAD FAILED (6) como
 * "pronto" — um vídeo que falhou ao codificar virava uma capa preta que não
 * toca, parecendo "arquivo corrompido" sem aviso nenhum. Agora 5/6 = `falhou`
 * e NÃO conta como pronto.
 */
export async function statusVideo(videoId: string): Promise<{ pronto: boolean; falhou: boolean; duracaoSeg: number }> {
  const { apiKey, libraryId } = creds();
  const resp = await fetch(`${BASE}/library/${libraryId}/videos/${videoId}`, {
    headers: { AccessKey: apiKey },
  });
  if (!resp.ok) throw new Error(`BUNNY_STATUS_FALHOU:${resp.status}`);
  const data = (await resp.json()) as { status: number; length: number };
  const falhou = data.status === 5 || data.status === 6;
  return { pronto: data.status >= 4 && !falhou, falhou, duracaoSeg: Math.round(data.length ?? 0) };
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

/**
 * URLs de MP4 pra download, da melhor resolução pra pior. Requer "MP4 Fallback"
 * habilitado na library. Vazio se o Bunny não está configurado ou sem resolução.
 *
 * IMPORTANTE: `availableResolutions` reflete o HLS — nem toda resolução listada
 * tem o `play_XXXp.mp4` gerado (MP4 Fallback desligado na época, ou vídeo
 * antigo). Por isso devolvemos TODAS as candidatas e o chamador tenta em ordem
 * até uma responder 200, em vez de apostar numa só.
 */
export async function mp4CandidateUrls(videoId: string): Promise<string[]> {
  if (!bunnyConfigurado()) return [];
  const { apiKey, libraryId, cdn } = creds();
  const resp = await fetch(`${BASE}/library/${libraryId}/videos/${videoId}`, { headers: { AccessKey: apiKey } });
  if (!resp.ok) return [];
  const data = (await resp.json()) as { availableResolutions?: string | null };
  const res = (data.availableResolutions ?? "").split(",").map((r) => r.trim()).filter(Boolean);
  const ordem = ["2160p", "1440p", "1080p", "720p", "480p", "360p", "240p"];
  const ordenadas = ordem.filter((r) => res.includes(r));
  for (const r of res) if (!ordenadas.includes(r)) ordenadas.push(r); // resoluções fora da lista, no fim
  return ordenadas.map((r) => `https://${cdn}/${videoId}/play_${r}.mp4`);
}

/**
 * URL do MP4 pra download da melhor resolução disponível. Requer "MP4 fallback"
 * habilitado na library. Retorna null se o Bunny não está configurado ou sem MP4.
 */
export async function urlDownloadMp4(videoId: string): Promise<string | null> {
  const cands = await mp4CandidateUrls(videoId);
  return cands[0] ?? null;
}
