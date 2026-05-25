// SERVER ONLY: chama Meta Graph API. Nunca importar do client.
//
// Auth: System User token (env META_SYSTEM_USER_TOKEN). Doc de setup em
// docs/trafego-meta-setup.md.

import { getServerEnv } from "@/lib/env";

const DEFAULT_VERSION = "v21.0";

function getApiBase(): string {
  const env = getServerEnv();
  const version = env.META_GRAPH_API_VERSION ?? DEFAULT_VERSION;
  return `https://graph.facebook.com/${version}`;
}

function getToken(): string {
  const env = getServerEnv();
  if (!env.META_SYSTEM_USER_TOKEN) {
    throw new Error(
      "META_SYSTEM_USER_TOKEN não configurado. Veja docs/trafego-meta-setup.md",
    );
  }
  return env.META_SYSTEM_USER_TOKEN;
}

/**
 * Normaliza um ad_account_id pra formato `act_123456789` esperado pela Graph API.
 * Aceita "act_123" ou só "123" como input.
 */
export function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

interface MetaErrorResponse {
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export class MetaApiError extends Error {
  /** Tipo curto pra UI/logs: ad_account_not_found, token_invalid, rate_limit, api_error */
  kind: "ad_account_not_found" | "token_invalid" | "rate_limit" | "api_error";
  fbCode?: number;

  constructor(message: string, kind: MetaApiError["kind"], fbCode?: number) {
    super(message);
    this.name = "MetaApiError";
    this.kind = kind;
    this.fbCode = fbCode;
  }
}

function classifyError(body: MetaErrorResponse, status: number): MetaApiError {
  const err = body.error;
  if (!err) return new MetaApiError(`HTTP ${status}`, "api_error");

  // Codes de referência: https://developers.facebook.com/docs/graph-api/guides/error-handling
  if (err.code === 100 && /Object with ID/i.test(err.message)) {
    return new MetaApiError(err.message, "ad_account_not_found", err.code);
  }
  if (err.code === 190 || err.code === 102) {
    return new MetaApiError(err.message, "token_invalid", err.code);
  }
  if (err.code === 17 || err.code === 4 || err.code === 32) {
    return new MetaApiError(err.message, "rate_limit", err.code);
  }
  return new MetaApiError(err.message, "api_error", err.code);
}

async function metaFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${getApiBase()}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("access_token", getToken());

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const body = await res.json();
  if (!res.ok) {
    throw classifyError(body as MetaErrorResponse, res.status);
  }
  return body as T;
}

// ─── Tipos das respostas ─────────────────────────────────────────────────────

export interface MetaCampaign {
  id: string;
  name: string;
  status: string; // ACTIVE | PAUSED | DELETED | ARCHIVED
  effective_status: string;
  objective?: string;
  daily_budget?: string; // em centavos da moeda (ex: "10000" = $100)
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time?: string;
}

interface CampaignsListResponse {
  data: MetaCampaign[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
}

/** Lista todas as campanhas de uma ad account. */
export async function listCampaigns(adAccountId: string): Promise<MetaCampaign[]> {
  const account = normalizeAdAccountId(adAccountId);
  const fields = [
    "id",
    "name",
    "status",
    "effective_status",
    "objective",
    "daily_budget",
    "lifetime_budget",
    "start_time",
    "stop_time",
    "created_time",
  ].join(",");

  const out: MetaCampaign[] = [];
  // Paginação manual (Meta retorna 25 por padrão; pedimos 100)
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { fields, limit: "100" };
    if (cursor) params.after = cursor;
    const res: CampaignsListResponse = await metaFetch(`/${account}/campaigns`, params);
    out.push(...res.data);
    cursor = res.paging?.cursors?.after && res.paging?.next ? res.paging.cursors.after : undefined;
  } while (cursor && out.length < 500); // hard cap de segurança

  return out;
}

// ─── Insights (métricas) ─────────────────────────────────────────────────────

export interface MetaInsightDay {
  date_start: string; // YYYY-MM-DD
  date_stop: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  frequency?: string;
}

interface InsightsResponse {
  data: MetaInsightDay[];
  paging?: { next?: string };
}

/** Busca insights diários de UMA campanha pra um range de datas. */
export async function getCampaignInsights(
  campaignId: string,
  sinceISO: string,
  untilISO: string,
): Promise<MetaInsightDay[]> {
  const fields = [
    "spend",
    "impressions",
    "reach",
    "clicks",
    "ctr",
    "cpc",
    "cpm",
    "frequency",
  ].join(",");

  const out: MetaInsightDay[] = [];
  // time_increment=1 → 1 linha por dia
  const params: Record<string, string> = {
    fields,
    time_increment: "1",
    time_range: JSON.stringify({ since: sinceISO, until: untilISO }),
    level: "campaign",
    limit: "100",
  };

  const res: InsightsResponse = await metaFetch(`/${campaignId}/insights`, params);
  out.push(...res.data);
  return out;
}

// ─── Insights agregados (para relatórios mensais) ───────────────────────────

export interface MetaAccountInsightsAggregate {
  spend: number;
  impressions?: number;
  reach?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  /** Conversões (offsite_conversions e on-site combined). Não vem direto da API
   * agregada, populada via `actions` quando disponível. */
  conversions?: number;
  cost_per_conversion?: number;
  /** Leads (action_type = "lead"). */
  leads?: number;
  cost_per_lead?: number;
}

interface AggregateInsightsRow {
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
}

interface AggregateInsightsResponse {
  data: AggregateInsightsRow[];
}

function pickAction(rows: Array<{ action_type: string; value: string }> | undefined, types: string[]): number | undefined {
  if (!rows) return undefined;
  let total = 0;
  let any = false;
  for (const r of rows) {
    if (types.includes(r.action_type)) {
      const n = Number(r.value);
      if (Number.isFinite(n)) { total += n; any = true; }
    }
  }
  return any ? total : undefined;
}

/** Insights agregados (única linha) da conta inteira pra um range de datas. */
export async function getAccountInsights(
  adAccountId: string,
  sinceISO: string,
  untilISO: string,
): Promise<MetaAccountInsightsAggregate> {
  const account = normalizeAdAccountId(adAccountId);
  const fields = [
    "spend", "impressions", "reach", "clicks", "ctr", "cpc",
    "actions", "cost_per_action_type",
  ].join(",");
  const params: Record<string, string> = {
    fields,
    time_range: JSON.stringify({ since: sinceISO, until: untilISO }),
    level: "account",
    limit: "1",
  };
  const res: AggregateInsightsResponse = await metaFetch(`/${account}/insights`, params);
  const row = res.data[0];
  if (!row) return { spend: 0 };

  const conversions = pickAction(row.actions, ["offsite_conversion", "purchase", "complete_registration"]);
  const leads = pickAction(row.actions, ["lead", "leadgen.other"]);
  const cost_per_conversion = pickAction(row.cost_per_action_type, ["offsite_conversion", "purchase", "complete_registration"]);
  const cost_per_lead = pickAction(row.cost_per_action_type, ["lead", "leadgen.other"]);

  return {
    spend: row.spend ? Number(row.spend) : 0,
    impressions: row.impressions ? Number(row.impressions) : undefined,
    reach: row.reach ? Number(row.reach) : undefined,
    clicks: row.clicks ? Number(row.clicks) : undefined,
    ctr: row.ctr ? Number(row.ctr) : undefined,
    cpc: row.cpc ? Number(row.cpc) : undefined,
    conversions,
    cost_per_conversion,
    leads,
    cost_per_lead,
  };
}

export interface MetaTopCampaign {
  name: string;
  spend: number;
  /** Resultados consolidados (conversions ou leads, o que tiver mais relevância). */
  results?: number;
}

interface CampaignInsightsRow {
  campaign_name?: string;
  spend?: string;
  actions?: Array<{ action_type: string; value: string }>;
}

interface CampaignInsightsResponse {
  data: CampaignInsightsRow[];
}

/** Top campanhas por spend (limite default 5) no range. */
export async function getTopCampaigns(
  adAccountId: string,
  sinceISO: string,
  untilISO: string,
  limit = 5,
): Promise<MetaTopCampaign[]> {
  const account = normalizeAdAccountId(adAccountId);
  const fields = ["campaign_name", "spend", "actions"].join(",");
  const params: Record<string, string> = {
    fields,
    time_range: JSON.stringify({ since: sinceISO, until: untilISO }),
    level: "campaign",
    sort: "spend_descending",
    limit: String(Math.max(1, Math.min(limit, 25))),
  };
  const res: CampaignInsightsResponse = await metaFetch(`/${account}/insights`, params);
  return res.data
    .filter((r) => r.campaign_name)
    .map((r) => ({
      name: r.campaign_name!,
      spend: r.spend ? Number(r.spend) : 0,
      results: pickAction(r.actions, ["lead", "leadgen.other", "offsite_conversion", "purchase"]),
    }));
}

/** Helper pra checar se a integração tá funcional (token + ad account válidos). */
export async function pingAdAccount(adAccountId: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  try {
    const account = normalizeAdAccountId(adAccountId);
    const res: { name: string } = await metaFetch(`/${account}`, { fields: "name" });
    return { ok: true, name: res.name };
  } catch (e) {
    if (e instanceof MetaApiError) {
      return { ok: false, error: `${e.kind}: ${e.message}` };
    }
    return { ok: false, error: String(e) };
  }
}
