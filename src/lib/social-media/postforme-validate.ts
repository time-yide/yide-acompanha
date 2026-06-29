const SO_VIDEO = new Set(["tiktok", "youtube"]);

function ehVideo(url: string): boolean {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

/** Retorna mensagem de erro se a combinação rede+mídia for inválida, ou null se ok. */
export function validarFormatoPorRede(redes: string[], midias: string[]): string | null {
  const temVideo = midias.some(ehVideo);
  for (const r of redes) {
    if (SO_VIDEO.has(r) && !temVideo) {
      return `${r === "tiktok" ? "TikTok" : "YouTube"} exige um vídeo no post.`;
    }
  }
  return null;
}
