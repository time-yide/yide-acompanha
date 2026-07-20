// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** Pacotes elegíveis pra Tráfego (mesmo critério do painel mensal). */
export const PACOTES_COM_TRAFEGO = [
  "trafego_estrategia", "trafego", "yide_360",
] as const;

export interface ClienteTrafegoRow {
  id: string;
  nome: string;
  tipo_pacote: string;
  assessor_id: string | null;
  coordenador_id: string | null;
  meta_ad_account_id: string | null;
  google_ads_customer_id: string | null;
  total_campanhas: number;
  campanhas_ativas: number;
}

/**
 * Lista clientes elegíveis pra Tráfego com contagem de campanhas.
 */
export async function listClientesTrafego(filter: {
  assessorId?: string | null;
  coordenadorId?: string | null;
  searchQuery?: string;
  /** Multi-tenant: filtra por unidade. */
  unitId?: string | null;
} = {}): Promise<ClienteTrafegoRow[]> {
  const supabase = createServiceRoleClient();

  // Helper pra fallback caso colunas novas não existam ainda no banco
  const buildClientsQuery = (selectStr: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("clients")
      .select(selectStr)
      .eq("status", "ativo")
      .in("tipo_pacote", [...PACOTES_COM_TRAFEGO]);
    if (filter.unitId) q = q.eq("unit_id", filter.unitId);
    if (filter.assessorId) q = q.eq("assessor_id", filter.assessorId);
    if (filter.coordenadorId) q = q.eq("coordenador_id", filter.coordenadorId);
    if (filter.searchQuery && filter.searchQuery.trim()) {
      q = q.ilike("nome", `%${filter.searchQuery.trim()}%`);
    }
    return q.order("nome");
  };

  const SELECT_COMPLETO = "id, nome, tipo_pacote, assessor_id, coordenador_id, meta_ad_account_id, google_ads_customer_id";
  const SELECT_FALLBACK = "id, nome, tipo_pacote, assessor_id, coordenador_id";

  let resp = await buildClientsQuery(SELECT_COMPLETO);
  if (resp.error) {
    const msg = resp.error.message ?? "";
    if (msg.includes("meta_ad_account_id") || msg.includes("google_ads_customer_id") || msg.includes("schema cache")) {
      console.warn("[trafego] colunas de ad accounts indisponíveis - usando fallback");
      resp = await buildClientsQuery(SELECT_FALLBACK);
    }
  }
  const clients = ((resp.data ?? []) as unknown as Array<{
    id: string;
    nome: string;
    tipo_pacote: string;
    assessor_id: string | null;
    coordenador_id: string | null;
    meta_ad_account_id?: string | null;
    google_ads_customer_id?: string | null;
  }>);

  if (clients.length === 0) return [];

  // Conta campanhas por cliente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: campanhasData } = await sb
    .from("trafego_campanhas")
    .select("client_id, status")
    .in("client_id", clients.map((c) => c.id))
    .is("archived_at", null);

  const campanhas = (campanhasData ?? []) as Array<{ client_id: string; status: string }>;
  const countByClient = new Map<string, { total: number; ativas: number }>();
  for (const c of campanhas) {
    const cur = countByClient.get(c.client_id) ?? { total: 0, ativas: 0 };
    cur.total += 1;
    if (c.status === "ativa") cur.ativas += 1;
    countByClient.set(c.client_id, cur);
  }

  return clients.map((c) => {
    const cnt = countByClient.get(c.id) ?? { total: 0, ativas: 0 };
    return {
      id: c.id,
      nome: c.nome,
      tipo_pacote: c.tipo_pacote,
      assessor_id: c.assessor_id,
      coordenador_id: c.coordenador_id,
      meta_ad_account_id: c.meta_ad_account_id ?? null,
      google_ads_customer_id: c.google_ads_customer_id ?? null,
      total_campanhas: cnt.total,
      campanhas_ativas: cnt.ativas,
    };
  });
}

export interface CampanhaRow {
  id: string;
  client_id: string;
  plataforma: string;
  nome: string;
  objetivo: string | null;
  status: string;
  budget_diario: number | null;
  budget_total: number | null;
  link_destino: string | null;
  copy: string | null;
  publico_alvo: string | null;
  criativo_url: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  observacoes: string | null;
  external_account_id: string | null;
  external_campaign_id: string | null;
  external_adset_id: string | null;
  external_ad_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function listCampanhasByCliente(clientId: string): Promise<CampanhaRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("trafego_campanhas")
    .select("*")
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  return ((data ?? []) as CampanhaRow[]);
}

export interface ClienteTrafegoDetalhe {
  id: string;
  nome: string;
  tipo_pacote: string;
  meta_ad_account_id: string | null;
  google_ads_customer_id: string | null;
  facebook_page_id: string | null;
  valor_trafego_google: number | null;
  valor_trafego_meta: number | null;
  meta_last_sync_at: string | null;
  meta_last_sync_error: string | null;
}

export async function getClienteTrafego(clientId: string): Promise<ClienteTrafegoDetalhe | null> {
  const supabase = createServiceRoleClient();

  const buildQuery = (selectStr: string) =>
    supabase.from("clients").select(selectStr).eq("id", clientId).maybeSingle();

  const SELECT_COMPLETO =
    "id, nome, tipo_pacote, meta_ad_account_id, google_ads_customer_id, facebook_page_id, valor_trafego_google, valor_trafego_meta, meta_last_sync_at, meta_last_sync_error";
  const SELECT_SEM_PAGE =
    "id, nome, tipo_pacote, meta_ad_account_id, google_ads_customer_id, valor_trafego_google, valor_trafego_meta, meta_last_sync_at, meta_last_sync_error";
  const SELECT_FALLBACK_META =
    "id, nome, tipo_pacote, meta_ad_account_id, google_ads_customer_id, valor_trafego_google, valor_trafego_meta";
  const SELECT_FALLBACK = "id, nome, tipo_pacote, valor_trafego_google, valor_trafego_meta";

  let resp = await buildQuery(SELECT_COMPLETO);
  if (resp.error) {
    const msg = resp.error.message ?? "";
    if (msg.includes("facebook_page_id")) {
      resp = await buildQuery(SELECT_SEM_PAGE);
    }
    // Reavalia com o resultado do retry (page pode ter sido a única col faltante)
    if (resp.error) {
      const msg2 = resp.error.message ?? "";
      if (msg2.includes("meta_last_sync_at") || msg2.includes("meta_last_sync_error")) {
        resp = await buildQuery(SELECT_FALLBACK_META);
      } else if (msg2.includes("meta_ad_account_id") || msg2.includes("google_ads_customer_id") || msg2.includes("schema cache")) {
        resp = await buildQuery(SELECT_FALLBACK);
      }
    }
  }
  if (!resp.data) return null;

  const c = resp.data as unknown as {
    id: string;
    nome: string;
    tipo_pacote: string;
    meta_ad_account_id?: string | null;
    google_ads_customer_id?: string | null;
    facebook_page_id?: string | null;
    valor_trafego_google: number | null;
    valor_trafego_meta: number | null;
    meta_last_sync_at?: string | null;
    meta_last_sync_error?: string | null;
  };
  return {
    id: c.id,
    nome: c.nome,
    tipo_pacote: c.tipo_pacote,
    meta_ad_account_id: c.meta_ad_account_id ?? null,
    google_ads_customer_id: c.google_ads_customer_id ?? null,
    facebook_page_id: c.facebook_page_id ?? null,
    valor_trafego_google: c.valor_trafego_google,
    valor_trafego_meta: c.valor_trafego_meta,
    meta_last_sync_at: c.meta_last_sync_at ?? null,
    meta_last_sync_error: c.meta_last_sync_error ?? null,
  };
}

/**
 * Agregados por campanha a partir de `trafego_metricas_diarias`.
 *
 * Soma as métricas somáveis (spend, impressions, reach, clicks, leads,
 * conversions) por campanha e deriva as de taxa/custo:
 *   ctr = clicks/impressions*100, cpc = spend/clicks, cpm = spend/impressions*1000,
 *   cost_per_lead = spend/leads, cost_per_conversion = spend/conversions.
 * Derivadas com denominador 0 são omitidas (não vira 0 nem Infinity).
 *
 * Retorno: { [campanhaId]: { [metricKey]: valor } } — consumido pela página
 * /trafego/[clientId] e passado ao componente de listagem.
 */
export async function getAgregadosByCliente(
  clientId: string,
): Promise<Record<string, Record<string, number>>> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // 1) Campanhas do cliente (não arquivadas)
  const { data: campanhasData } = await sb
    .from("trafego_campanhas")
    .select("id")
    .eq("client_id", clientId)
    .is("archived_at", null);
  const campanhaIds = ((campanhasData ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (campanhaIds.length === 0) return {};

  // 2) Todas as métricas diárias dessas campanhas
  const { data: metricasData } = await sb
    .from("trafego_metricas_diarias")
    .select("campanha_id, metrica_key, valor_numerico")
    .in("campanha_id", campanhaIds);

  const rows = (metricasData ?? []) as Array<{
    campanha_id: string;
    metrica_key: string;
    valor_numerico: number | string | null;
  }>;

  // Chaves que somamos direto; as derivadas (ctr/cpc/cpm/cost_per_*) são recalculadas.
  const SOMAVEIS = new Set(["spend", "impressions", "reach", "clicks", "leads", "conversions"]);

  // 3) Soma por campanha
  const somasPorCampanha = new Map<string, Record<string, number>>();
  for (const r of rows) {
    if (!SOMAVEIS.has(r.metrica_key)) continue;
    const v = typeof r.valor_numerico === "string" ? Number(r.valor_numerico) : r.valor_numerico;
    if (v == null || !Number.isFinite(v)) continue;
    const acc = somasPorCampanha.get(r.campanha_id) ?? {};
    acc[r.metrica_key] = (acc[r.metrica_key] ?? 0) + v;
    somasPorCampanha.set(r.campanha_id, acc);
  }

  // 4) Deriva taxas/custos (protegendo divisão por zero → omite a chave)
  const out: Record<string, Record<string, number>> = {};
  for (const [campanhaId, s] of somasPorCampanha) {
    const spend = s.spend ?? 0;
    const impressions = s.impressions ?? 0;
    const clicks = s.clicks ?? 0;
    const leads = s.leads ?? 0;
    const conversions = s.conversions ?? 0;

    const m: Record<string, number> = { ...s };
    if (impressions > 0) {
      m.ctr = (clicks / impressions) * 100;
      m.cpm = (spend / impressions) * 1000;
    }
    if (clicks > 0) m.cpc = spend / clicks;
    if (leads > 0) m.cost_per_lead = spend / leads;
    if (conversions > 0) m.cost_per_conversion = spend / conversions;

    out[campanhaId] = m;
  }

  return out;
}

/**
 * Métricas visíveis configuradas pelo usuário. Quando array vazio/null,
 * retorna o default (kit padrão de agência). UI pode chamar essa função
 * em qualquer page.
 */
export async function getMetricasVisiveisDoUsuario(userId: string): Promise<string[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("profiles")
    .select("trafego_metricas_visiveis")
    .eq("id", userId)
    .maybeSingle();
  const arr = ((data as { trafego_metricas_visiveis?: string[] | null } | null)?.trafego_metricas_visiveis) ?? null;
  if (arr && arr.length > 0) return arr;
  // Importa aqui pra evitar circular
  const { METRICAS_DEFAULT } = await import("./metricas");
  return [...METRICAS_DEFAULT];
}
