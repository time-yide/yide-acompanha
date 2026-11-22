// SERVER ONLY
import "server-only";
import type { PublicadoYideEcom } from "./yideecom-match";
import type { SugestoesClienteYideEcom, VendasClienteYideEcom } from "./yideecom-vendas";

/**
 * Leitura da API externa do Yide Ecom (/api/external/*), protegida por Bearer.
 *
 * Env: YIDEECOM_API_URL (ex.: https://yideecom.vercel.app) e YIDEECOM_API_SECRET
 * (mesmo valor de ACOMPANHA_API_SECRET no Yide Ecom).
 */
type Erro = "nao_configurado" | "falha";
export type YideEcomResultado<T> = { ok: true; dados: T } | { ok: false; erro: Erro };

async function getYideEcom<T>(
  path: string,
  params: Record<string, string>,
  pick: (body: unknown) => T,
  opts: { timeoutMs: number; revalidate?: number },
): Promise<YideEcomResultado<T>> {
  const url = process.env.YIDEECOM_API_URL?.trim().replace(/\/+$/, "");
  const secret = process.env.YIDEECOM_API_SECRET?.trim();
  if (!url || !secret) return { ok: false, erro: "nao_configurado" };

  try {
    const qs = new URLSearchParams(params);
    const res = await fetch(`${url}${path}?${qs.toString()}`, {
      headers: { authorization: `Bearer ${secret}` },
      ...(opts.revalidate ? { next: { revalidate: opts.revalidate } } : { cache: "no-store" as const }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    if (!res.ok) {
      console.error("[ecommerce] yideecom", path, "HTTP", res.status);
      return { ok: false, erro: "falha" };
    }
    return { ok: true, dados: pick(await res.json()) };
  } catch (e) {
    console.error("[ecommerce] yideecom", path, e);
    return { ok: false, erro: "falha" };
  }
}

function lista<T>(body: unknown, key: string): T[] {
  const v = (body as Record<string, unknown> | null)?.[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

/** Anúncios publicados (Mercado Livre e Tray) por cliente/dia/canal. */
export function listPublicadosYideEcom(de: string, ate: string) {
  return getYideEcom("/api/external/publicados", { de, ate }, (b) => lista<PublicadoYideEcom>(b, "publicados"), {
    timeoutMs: 8000,
  });
}

/**
 * Vendas de todos os clientes no período. O Yide Ecom busca pedido a pedido no
 * ML/Tray (lento), então guarda 10 min: trocar o filtro de cliente/canal é na hora.
 */
export function listVendasYideEcom(de: string, ate: string) {
  return getYideEcom("/api/external/vendas", { de, ate }, (b) => lista<VendasClienteYideEcom>(b, "clientes"), {
    timeoutMs: 120_000,
    revalidate: 600,
  });
}

/** Alertas abertos e anúncios com nota baixa (o Yide Ecom confere a cada 30 min). */
export function listSugestoesYideEcom() {
  return getYideEcom("/api/external/sugestoes", {}, (b) => lista<SugestoesClienteYideEcom>(b, "clientes"), {
    timeoutMs: 20_000,
    revalidate: 300,
  });
}
