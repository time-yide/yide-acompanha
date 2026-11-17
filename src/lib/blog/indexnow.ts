// IndexNow avisa Bing e outros buscadores na hora que uma página nova sai. A chave é
// pública por definição: fica em public/ pra provar que o site é nosso.
import { SITE_URL } from "./config";

const INDEXNOW_KEY = "7628374b0768d7ee0a396466e90cb488";
export const INDEXNOW_ARQUIVO = `/${INDEXNOW_KEY}.txt`;

export function montarAvisoIndexNow(slugs: string[], siteUrl: string) {
  return {
    host: new URL(siteUrl).host,
    key: INDEXNOW_KEY,
    keyLocation: `${siteUrl}${INDEXNOW_ARQUIVO}`,
    urlList: slugs.map((s) => `${siteUrl}/blog/${s}`),
  };
}

/** Best-effort: falha aqui não pode atrapalhar a publicação. */
export async function avisarBuscadores(slugs: string[]): Promise<void> {
  if (slugs.length === 0) return;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(montarAvisoIndexNow(slugs, SITE_URL)),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("[blog] IndexNow:", res.status);
  } catch (e) {
    console.error("[blog] IndexNow:", e);
  }
}
