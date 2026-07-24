"use client";

import * as tus from "tus-js-client";
import type { UploadTus } from "@/lib/bunny/client";

/**
 * Sobe um arquivo pro Bunny via TUS. Resolve quando o upload dos BYTES termina
 * (não espera o Bunny processar). Rejeita em erro de upload.
 */
export function uploadVideoTus(
  file: File,
  upload: UploadTus,
  titulo: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const up = new tus.Upload(file, {
      endpoint: upload.endpoint,
      // Upload em pedaços de 50MB (múltiplo de 256KB) → resumível: um soluço da
      // rede reenvia só o pedaço atual em vez do arquivo inteiro. Também evita o
      // request único gigante (que servidores rejeitam com 413) em vídeos de
      // câmera grandes. Múltiplas tentativas com backoff pra uploads longos.
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000, 30000],
      removeFingerprintOnSuccess: true,
      headers: {
        AuthorizationSignature: upload.signature,
        AuthorizationExpire: String(upload.expiration),
        VideoId: upload.videoId,
        LibraryId: upload.libraryId,
      },
      metadata: { filetype: file.type, title: titulo },
      onError: (err) => reject(err),
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    up.start();
  });
}
