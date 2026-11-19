// SERVER ONLY
import "server-only";
import type { PublicadoYideEcom } from "./yideecom-match";

/**
 * Anúncios publicados pelo Yide Ecom (Mercado Livre e Tray), por cliente/dia/canal.
 * Lê a API externa do Yide Ecom (/api/external/publicados), protegida por Bearer.
 *
 * Env: YIDEECOM_API_URL (ex.: https://yideecom.vercel.app) e YIDEECOM_API_SECRET
 * (mesmo valor de ACOMPANHA_API_SECRET no Yide Ecom).
 */
export type YideEcomResultado =
  | { ok: true; publicados: PublicadoYideEcom[] }
  | { ok: false; erro: "nao_configurado" | "falha" };

export async function listPublicadosYideEcom(de: string, ate: string): Promise<YideEcomResultado> {
  const url = process.env.YIDEECOM_API_URL?.trim().replace(/\/+$/, "");
  const secret = process.env.YIDEECOM_API_SECRET?.trim();
  if (!url || !secret) return { ok: false, erro: "nao_configurado" };

  try {
    const qs = new URLSearchParams({ de, ate });
    const res = await fetch(`${url}/api/external/publicados?${qs.toString()}`, {
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[ecommerce] yideecom HTTP", res.status);
      return { ok: false, erro: "falha" };
    }
    const body = (await res.json()) as { publicados?: PublicadoYideEcom[] };
    return { ok: true, publicados: Array.isArray(body.publicados) ? body.publicados : [] };
  } catch (e) {
    console.error("[ecommerce] yideecom", e);
    return { ok: false, erro: "falha" };
  }
}
