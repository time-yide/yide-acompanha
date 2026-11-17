"use client";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Contagem de visitas sem cookie (Vercel Web Analytics). Não grava nada no aparelho do
 * visitante, por isso não depende do aviso de cookies. Antes de enviar, tira da URL tudo
 * que não for UTM (gclid, fbclid, e-mail em link etc.) para não levar dado pessoal junto.
 */
export function limparUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const chave of [...u.searchParams.keys()]) {
      if (!chave.startsWith("utm_")) u.searchParams.delete(chave);
    }
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

export function ContadorVisitas() {
  return <Analytics beforeSend={(e: BeforeSendEvent) => ({ ...e, url: limparUrl(e.url) })} />;
}
