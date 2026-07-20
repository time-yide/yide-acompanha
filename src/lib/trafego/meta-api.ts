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

/**
 * POST na Graph API (application/x-www-form-urlencoded). Objetos aninhados
 * (targeting, object_story_spec, creative) devem ser passados JÁ como JSON
 * string no campo correspondente. `access_token` é injetado no body.
 */
async function metaPost<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    form.set(k, v);
  }
  form.set("access_token", getToken());

  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
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

  // Por padrão o Meta esconde campanhas ARQUIVADAS (e às vezes as encerradas).
  // Passamos effective_status explícito pra trazer também as antigas/arquivadas
  // (tudo menos DELETED), senão contas com histórico voltam vazias no sync.
  // A lista é ampla de propósito: alguns desses status só aparecem em contas
  // com histórico de pausas/rejeições/pendências, e omitir qualquer um pode
  // fazer a conta voltar vazia.
  const effectiveStatus = JSON.stringify(CAMPAIGN_EFFECTIVE_STATUSES);

  const withFilter = await fetchAllCampaigns(account, fields, effectiveStatus);
  if (withFilter.length > 0) return withFilter;

  // Fallback: se COM o filtro deu 0, tenta SEM effective_status (default do Meta).
  // Se o filtro estiver excluindo tudo, o default resgata. Erros da API
  // (ex.: filtro inválido) propagam como MetaApiError — não engolimos.
  return fetchAllCampaigns(account, fields, undefined);
}

/**
 * Status ampla passada em `effective_status`. Cobre tudo menos DELETED —
 * inclui os status que o Meta só reporta em campanhas desativadas/pausadas
 * com histórico (rejeição, revisão, pendência de billing, etc.).
 */
const CAMPAIGN_EFFECTIVE_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
  "IN_PROCESS",
  "WITH_ISSUES",
  "CAMPAIGN_PAUSED",
  "ADSET_PAUSED",
  "PENDING_REVIEW",
  "DISAPPROVED",
  "PREAPPROVED",
  "PENDING_BILLING_INFO",
] as const;

/**
 * Pagina todas as campanhas de uma conta. Se `effectiveStatus` for passado,
 * filtra por effective_status; senão usa o default do Meta.
 */
async function fetchAllCampaigns(
  account: string,
  fields: string,
  effectiveStatus: string | undefined,
): Promise<MetaCampaign[]> {
  const out: MetaCampaign[] = [];
  // Paginação manual (Meta retorna 25 por padrão; pedimos 100)
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { fields, limit: "100" };
    if (effectiveStatus) params.effective_status = effectiveStatus;
    if (cursor) params.after = cursor;
    const res: CampaignsListResponse = await metaFetch(`/${account}/campaigns`, params);
    out.push(...res.data);
    cursor = res.paging?.cursors?.after && res.paging?.next ? res.paging.cursors.after : undefined;
  } while (cursor && out.length < 500); // hard cap de segurança

  return out;
}

/**
 * Diagnóstico do sync: faz DUAS chamadas (com e sem effective_status) e
 * devolve as contagens + uma amostra (até 10) de nome/status pra a gente ver
 * exatamente o que a Graph API retorna. NÃO expõe o token.
 */
export async function debugListCampaigns(adAccountId: string): Promise<{
  comFiltro: number;
  semFiltro: number;
  amostra: Array<{ name: string; status: string; effective_status: string }>;
}> {
  const account = normalizeAdAccountId(adAccountId);
  const fields = ["id", "name", "status", "effective_status"].join(",");
  const effectiveStatus = JSON.stringify(CAMPAIGN_EFFECTIVE_STATUSES);

  const comFiltroList = await fetchAllCampaigns(account, fields, effectiveStatus);
  const semFiltroList = await fetchAllCampaigns(account, fields, undefined);

  // Amostra: prefere a lista maior (a que trouxe mais campanhas)
  const base = semFiltroList.length >= comFiltroList.length ? semFiltroList : comFiltroList;
  const amostra = base.slice(0, 10).map((c) => ({
    name: c.name,
    status: c.status,
    effective_status: c.effective_status,
  }));

  return {
    comFiltro: comFiltroList.length,
    semFiltro: semFiltroList.length,
    amostra,
  };
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
  /** Ações (leads, conversões, etc.). Só vem quando pedimos `actions` nos fields. */
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
}

interface InsightsResponse {
  data: MetaInsightDay[];
  paging?: { next?: string };
}

/**
 * Action types que consideramos "lead" e "conversão" ao extrair de `actions`.
 * Reusado pelo sync e pelos agregados de drill-down.
 */
export const LEAD_ACTION_TYPES = ["lead", "leadgen.other"];
export const CONVERSION_ACTION_TYPES = ["offsite_conversion", "purchase", "complete_registration"];

/**
 * Busca insights diários de UMA campanha pra um range de datas.
 * Traz também `actions`/`cost_per_action_type` pra o sync extrair leads/conversões.
 */
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
    "actions",
    "cost_per_action_type",
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

// ─── Conjuntos de anúncios (ad sets) e anúncios (ads) ────────────────────────

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  daily_budget?: string; // centavos
  lifetime_budget?: string; // centavos
  optimization_goal?: string;
  start_time?: string;
  end_time?: string;
}

interface AdSetsListResponse {
  data: MetaAdSet[];
  paging?: { cursors?: { after?: string }; next?: string };
}

/** Lista os conjuntos de anúncios (ad sets) de uma campanha. */
export async function listAdSets(campaignId: string): Promise<MetaAdSet[]> {
  const fields = [
    "id",
    "name",
    "status",
    "effective_status",
    "daily_budget",
    "lifetime_budget",
    "optimization_goal",
    "start_time",
    "end_time",
  ].join(",");

  const out: MetaAdSet[] = [];
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { fields, limit: "100" };
    if (cursor) params.after = cursor;
    const res: AdSetsListResponse = await metaFetch(`/${campaignId}/adsets`, params);
    out.push(...res.data);
    cursor = res.paging?.cursors?.after && res.paging?.next ? res.paging.cursors.after : undefined;
  } while (cursor && out.length < 500);

  return out;
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  creative?: {
    id?: string;
    thumbnail_url?: string;
    image_url?: string;
    body?: string;
    title?: string;
  };
  /** Atalhos vindos do creative, quando houver. */
  thumbnail_url?: string;
  image_url?: string;
}

interface AdsListResponse {
  data: Array<{
    id: string;
    name: string;
    status: string;
    effective_status: string;
    creative?: {
      id?: string;
      thumbnail_url?: string;
      image_url?: string;
      body?: string;
      title?: string;
    };
  }>;
  paging?: { cursors?: { after?: string }; next?: string };
}

/** Lista os anúncios (ads) de um conjunto (ad set), com dados do criativo. */
export async function listAds(adsetId: string): Promise<MetaAd[]> {
  const fields = [
    "id",
    "name",
    "status",
    "effective_status",
    "creative{id,thumbnail_url,image_url,body,title}",
  ].join(",");

  const out: MetaAd[] = [];
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { fields, limit: "100" };
    if (cursor) params.after = cursor;
    const res: AdsListResponse = await metaFetch(`/${adsetId}/ads`, params);
    for (const r of res.data) {
      out.push({
        ...r,
        thumbnail_url: r.creative?.thumbnail_url,
        image_url: r.creative?.image_url,
      });
    }
    cursor = res.paging?.cursors?.after && res.paging?.next ? res.paging.cursors.after : undefined;
  } while (cursor && out.length < 500);

  return out;
}

// ─── Insights agregados por objeto (campaign|adset|ad) num período ───────────

export interface MetaInsightsAggregate {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  leads?: number;
  conversions?: number;
  cost_per_lead?: number;
  cost_per_conversion?: number;
}

interface ObjectAggregateRow {
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  frequency?: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
}

interface ObjectAggregateResponse {
  data: ObjectAggregateRow[];
}

function insightNum(v: string | undefined): number {
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Converte uma linha de /insights num MetaInsightsAggregate. Compartilhado por
 * `getInsightsAggregate` (1 objeto) e `getInsightsByObject` (breakdown por id).
 */
function parseInsightRow(row: ObjectAggregateRow): MetaInsightsAggregate {
  return {
    spend: insightNum(row.spend),
    impressions: insightNum(row.impressions),
    reach: insightNum(row.reach),
    clicks: insightNum(row.clicks),
    ctr: insightNum(row.ctr),
    cpc: insightNum(row.cpc),
    cpm: insightNum(row.cpm),
    frequency: insightNum(row.frequency),
    leads: pickAction(row.actions, LEAD_ACTION_TYPES),
    conversions: pickAction(row.actions, CONVERSION_ACTION_TYPES),
    cost_per_lead: pickAction(row.cost_per_action_type, LEAD_ACTION_TYPES),
    cost_per_conversion: pickAction(row.cost_per_action_type, CONVERSION_ACTION_TYPES),
  };
}

/** Zeros pra objetos sem linha de insight no período. */
function zeroAggregate(): MetaInsightsAggregate {
  return {
    spend: 0, impressions: 0, reach: 0, clicks: 0,
    ctr: 0, cpc: 0, cpm: 0, frequency: 0,
  };
}

/**
 * Insights agregados (única linha) de UM objeto — campanha, conjunto ou anúncio —
 * num período. Retorna zeros quando não há dados. Extrai leads/conversões de
 * `actions`/`cost_per_action_type` via `pickAction`.
 */
export async function getInsightsAggregate(
  objectId: string,
  level: "campaign" | "adset" | "ad",
  sinceISO: string,
  untilISO: string,
): Promise<MetaInsightsAggregate> {
  const fields = [
    "spend",
    "impressions",
    "reach",
    "clicks",
    "ctr",
    "cpc",
    "cpm",
    "frequency",
    "actions",
    "cost_per_action_type",
  ].join(",");
  const params: Record<string, string> = {
    fields,
    time_range: JSON.stringify({ since: sinceISO, until: untilISO }),
    level,
    limit: "1",
  };

  const res: ObjectAggregateResponse = await metaFetch(`/${objectId}/insights`, params);
  const row = res.data[0];
  if (!row) return zeroAggregate();
  return parseInsightRow(row);
}

interface BreakdownRow extends ObjectAggregateRow {
  adset_id?: string;
  ad_id?: string;
}

interface BreakdownResponse {
  data: BreakdownRow[];
  paging?: { next?: string; cursors?: { after?: string } };
}

/**
 * UMA chamada a /{parentId}/insights com `level` (adset|ad) que devolve uma linha
 * POR objeto filho no período. Substitui o loop de N chamadas por objeto (que
 * estourava o rate-limit do Meta). Indexa por `adset_id`/`ad_id`.
 *
 * Objetos sem linha de insight simplesmente não estão no Map → a UI mostra zeros.
 */
export async function getInsightsByObject(
  parentId: string,
  level: "adset" | "ad",
  sinceISO: string,
  untilISO: string,
): Promise<Map<string, MetaInsightsAggregate>> {
  const idField = level === "adset" ? "adset_id" : "ad_id";
  const fields = [
    idField,
    "spend",
    "impressions",
    "reach",
    "clicks",
    "ctr",
    "cpc",
    "cpm",
    "frequency",
    "actions",
    "cost_per_action_type",
  ].join(",");

  const out = new Map<string, MetaInsightsAggregate>();
  let cursor: string | undefined;
  let pages = 0;
  do {
    const params: Record<string, string> = {
      fields,
      time_range: JSON.stringify({ since: sinceISO, until: untilISO }),
      level,
      limit: "500",
    };
    if (cursor) params.after = cursor;
    const res: BreakdownResponse = await metaFetch(`/${parentId}/insights`, params);
    for (const row of res.data) {
      const id = level === "adset" ? row.adset_id : row.ad_id;
      if (id) out.set(id, parseInsightRow(row));
    }
    cursor = res.paging?.cursors?.after && res.paging?.next ? res.paging.cursors.after : undefined;
    pages += 1;
  } while (cursor && pages < 10); // cap de segurança

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

export function pickAction(rows: Array<{ action_type: string; value: string }> | undefined, types: string[]): number | undefined {
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

/** Um ponto da série diária de uma conta (spend + resultados no dia). */
export interface MetaAccountDailyPoint {
  /** YYYY-MM-DD */
  data: string;
  spend: number;
  /** Leads + conversões do dia (o que a conta reporta em `actions`). */
  resultados?: number;
}

interface DailyInsightsRow {
  date_start?: string;
  spend?: string;
  actions?: Array<{ action_type: string; value: string }>;
}

interface DailyInsightsResponse {
  data: DailyInsightsRow[];
  paging?: { next?: string; cursors?: { after?: string } };
}

/**
 * Série diária da conta pra o range: uma linha por dia (`time_increment=1`)
 * com spend e resultados (leads + conversões extraídos de `actions`). Usada
 * pelo gráfico de evolução do relatório. Retorna [] quando não há dados.
 */
export async function getAccountDailyInsights(
  adAccountId: string,
  sinceISO: string,
  untilISO: string,
): Promise<MetaAccountDailyPoint[]> {
  const account = normalizeAdAccountId(adAccountId);
  const fields = ["spend", "actions"].join(",");
  const out: MetaAccountDailyPoint[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const params: Record<string, string> = {
      fields,
      time_increment: "1",
      time_range: JSON.stringify({ since: sinceISO, until: untilISO }),
      level: "account",
      limit: "100",
    };
    if (cursor) params.after = cursor;
    const res: DailyInsightsResponse = await metaFetch(`/${account}/insights`, params);
    for (const row of res.data) {
      if (!row.date_start) continue;
      const resultados = pickAction(row.actions, [
        ...LEAD_ACTION_TYPES,
        ...CONVERSION_ACTION_TYPES,
      ]);
      out.push({
        data: row.date_start,
        spend: row.spend ? Number(row.spend) : 0,
        resultados,
      });
    }
    cursor = res.paging?.cursors?.after && res.paging?.next ? res.paging.cursors.after : undefined;
    pages += 1;
  } while (cursor && pages < 12); // cap: ~1200 dias

  return out;
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

// ─── Criação de anúncios (SEMPRE PAUSED) ─────────────────────────────────────
//
// Sequência: campanha → conjunto (ad set) → criativo → anúncio.
// TUDO criado com status='PAUSED'. Não existe caminho pra ACTIVE aqui.

interface MetaCreateResponse {
  id: string;
}

/**
 * Cria uma campanha PAUSADA. `special_ad_categories` é obrigatório (array vazio
 * = sem categoria especial de anúncio).
 */
export async function criarCampanhaMeta(
  adAccountId: string,
  input: { nome: string; objective: string },
): Promise<{ id: string }> {
  const account = normalizeAdAccountId(adAccountId);
  const res = await metaPost<MetaCreateResponse>(`/${account}/campaigns`, {
    name: input.nome,
    objective: input.objective,
    status: "PAUSED",
    special_ad_categories: "[]",
  });
  return { id: res.id };
}

/**
 * Cria um conjunto de anúncios (ad set) PAUSADO com orçamento diário em
 * centavos. `targeting` é um objeto que será serializado como JSON.
 */
export async function criarAdSetMeta(
  adAccountId: string,
  input: {
    nome: string;
    campaignId: string;
    dailyBudgetCents: number;
    optimizationGoal: string;
    targeting: unknown;
    startTime?: string;
    endTime?: string;
  },
): Promise<{ id: string }> {
  const account = normalizeAdAccountId(adAccountId);
  const params: Record<string, string> = {
    name: input.nome,
    campaign_id: input.campaignId,
    status: "PAUSED",
    daily_budget: String(input.dailyBudgetCents),
    billing_event: "IMPRESSIONS",
    optimization_goal: input.optimizationGoal,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: JSON.stringify(input.targeting),
  };
  if (input.startTime) params.start_time = input.startTime;
  if (input.endTime) params.end_time = input.endTime;

  const res = await metaPost<MetaCreateResponse>(`/${account}/adsets`, params);
  return { id: res.id };
}

/**
 * Cria um criativo (ad creative) de imagem única. Usa a URL pública da imagem
 * direto em `picture`. `instagramActorId` é opcional (pra veicular no IG).
 */
export async function criarCreativeMeta(
  adAccountId: string,
  input: {
    nome: string;
    pageId: string;
    instagramActorId?: string | null;
    mensagem: string;
    link: string;
    imagemUrl: string;
    callToAction: string;
  },
): Promise<{ id: string }> {
  const account = normalizeAdAccountId(adAccountId);

  const linkData: Record<string, unknown> = {
    message: input.mensagem,
    link: input.link,
    picture: input.imagemUrl,
    call_to_action: {
      type: input.callToAction,
      value: { link: input.link },
    },
  };

  const objectStorySpec: Record<string, unknown> = {
    page_id: input.pageId,
    link_data: linkData,
  };
  if (input.instagramActorId) {
    objectStorySpec.instagram_actor_id = input.instagramActorId;
  }

  const res = await metaPost<MetaCreateResponse>(`/${account}/adcreatives`, {
    name: input.nome,
    object_story_spec: JSON.stringify(objectStorySpec),
  });
  return { id: res.id };
}

/** Cria o anúncio (ad) PAUSADO, ligando ad set + criativo. */
export async function criarAdMeta(
  adAccountId: string,
  input: { nome: string; adsetId: string; creativeId: string },
): Promise<{ id: string }> {
  const account = normalizeAdAccountId(adAccountId);
  const res = await metaPost<MetaCreateResponse>(`/${account}/ads`, {
    name: input.nome,
    adset_id: input.adsetId,
    creative: JSON.stringify({ creative_id: input.creativeId }),
    status: "PAUSED",
  });
  return { id: res.id };
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
