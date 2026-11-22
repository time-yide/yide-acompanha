// SERVER ONLY
import "server-only";
import { getGoogleToken } from "../google-auth";
import type { Periodo } from "../tipos";

async function gpost<T>(url: string, body: unknown): Promise<T | null> {
  const token = await getGoogleToken();
  if (!token) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.error("[dados/google] POST", url.split("?")[0], res.status); return null; }
    return (await res.json()) as T;
  } catch (e) { console.error("[dados/google]", e); return null; }
}
async function gget<T>(url: string): Promise<T | null> {
  const token = await getGoogleToken();
  if (!token) return null;
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) { console.error("[dados/google] GET", url.split("?")[0], res.status); return null; }
    return (await res.json()) as T;
  } catch (e) { console.error("[dados/google]", e); return null; }
}

/** Sessões no período e no anterior (2 dateRanges num relatório só). */
export async function coletarGa4(propertyId: string, atual: Periodo, anterior: Periodo) {
  const j = await gpost<{ rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }> }>(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      dateRanges: [
        { startDate: atual.de, endDate: atual.ate, name: "atual" },
        { startDate: anterior.de, endDate: anterior.ate, name: "anterior" },
      ],
      metrics: [{ name: "sessions" }],
    },
  );
  if (!j) return null;
  let sessoes = 0, sessoesAnt = 0;
  for (const row of j.rows ?? []) {
    const v = Number(row.metricValues[0]?.value ?? 0);
    if (row.dimensionValues[0]?.value === "anterior") sessoesAnt += v; else sessoes += v;
  }
  return { sessoes, sessoesAnt };
}

/** Cliques e posição média no período + cliques no anterior. */
export async function coletarGsc(siteUrl: string, atual: Periodo, anterior: Periodo) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  type R = { rows?: Array<{ clicks: number; position: number }> };
  const [a, b] = await Promise.all([
    gpost<R>(url, { startDate: atual.de, endDate: atual.ate }),
    gpost<R>(url, { startDate: anterior.de, endDate: anterior.ate }),
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
