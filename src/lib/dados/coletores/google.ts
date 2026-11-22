// SERVER ONLY
import "server-only";
import { getGoogleToken } from "../google-auth";
import type { Periodo } from "../tipos";

async function logErro(prefixo: string, res: Response) {
  let detalhe = "";
  try {
    const j = (await res.json()) as { error?: { code?: number; message?: string; status?: string } };
    detalhe = [j.error?.code, j.error?.status, j.error?.message].filter(Boolean).join(" ");
  } catch { /* corpo não-JSON */ }
  console.error(`[dados/google] ${prefixo}`, res.status, detalhe);
}
const nomeErro = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : "erro");

async function gpost<T>(url: string, body: unknown): Promise<T | null> {
  const token = await getGoogleToken();
  if (!token) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { await logErro(`POST ${url.split("?")[0]}`, res); return null; }
    return (await res.json()) as T;
  } catch (e) { console.error("[dados/google]", nomeErro(e)); return null; }
}
async function gget<T>(url: string): Promise<T | null> {
  const token = await getGoogleToken();
  if (!token) return null;
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) { await logErro(`GET ${url.split("?")[0]}`, res); return null; }
    return (await res.json()) as T;
  } catch (e) { console.error("[dados/google]", nomeErro(e)); return null; }
}

type Ga4Report = {
  dimensionHeaders?: Array<{ name: string }>;
  rows?: Array<{ dimensionValues?: Array<{ value: string }>; metricValues?: Array<{ value: string }> }>;
};

/** Soma sessões por dateRange ("atual" / "anterior"). Nunca lança. */
export function somarSessoesGa4(j: Ga4Report): { sessoes: number; sessoesAnt: number } {
  const idx = j.dimensionHeaders?.findIndex((h) => h.name === "dateRange") ?? -1;
  let sessoes = 0, sessoesAnt = 0;
  if (idx < 0) return { sessoes, sessoesAnt };
  for (const row of j.rows ?? []) {
    const nome = row.dimensionValues?.[idx]?.value;
    const v = Number(row.metricValues?.[0]?.value ?? 0) || 0;
    if (nome === "atual") sessoes += v;
    else if (nome === "anterior") sessoesAnt += v;
  }
  return { sessoes, sessoesAnt };
}

/** Sessões no período e no anterior (2 dateRanges num relatório só). */
export async function coletarGa4(propertyId: string, atual: Periodo, anterior: Periodo) {
  try {
    const id = propertyId.replace(/^properties\//, "");
    const j = await gpost<Ga4Report>(
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(id)}:runReport`,
      {
        dateRanges: [
          { startDate: atual.de, endDate: atual.ate, name: "atual" },
          { startDate: anterior.de, endDate: anterior.ate, name: "anterior" },
        ],
        metrics: [{ name: "sessions" }],
      },
    );
    if (!j) return null;
    return somarSessoesGa4(j);
  } catch (e) { console.error("[dados/google] ga4", nomeErro(e)); return null; }
}

/** Cliques e posição média no período + cliques no anterior. */
export async function coletarGsc(siteUrl: string, atual: Periodo, anterior: Periodo) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  type R = { rows?: Array<{ clicks: number; position: number }> };
  const [a, b] = await Promise.all([
    gpost<R>(url, { startDate: atual.de, endDate: atual.ate, dataState: "all" }),
    gpost<R>(url, { startDate: anterior.de, endDate: anterior.ate, dataState: "all" }),
  ]);
  if (!a || !b) return null;
  return {
    cliques: a.rows?.[0]?.clicks ?? 0,
    cliquesAnt: b.rows?.[0]?.clicks ?? 0,
    posicao: a.rows?.[0]?.position ?? null,
  };
}

/** Opções para o cartão de conexões. */
export async function listarPropriedadesGa4(): Promise<Array<{ id: string; nome: string }>> {
  const j = await gget<{ accountSummaries?: Array<{ displayName: string; propertySummaries?: Array<{ property: string; displayName: string }> }> }>(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
  );
  return (j?.accountSummaries ?? []).flatMap((a) =>
    (a.propertySummaries ?? []).map((p) => ({ id: p.property.replace("properties/", ""), nome: `${a.displayName} — ${p.displayName}` })));
}
export async function listarSitesGsc(): Promise<string[]> {
  const j = await gget<{ siteEntry?: Array<{ siteUrl: string }> }>("https://www.googleapis.com/webmasters/v3/sites");
  return (j?.siteEntry ?? []).map((s) => s.siteUrl).sort();
}
