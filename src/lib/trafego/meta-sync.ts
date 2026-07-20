// SERVER ONLY: orquestra a sync com Meta Ads.
//
// Fluxo:
// 1. Busca campanhas no Meta (graph API)
// 2. Upsert em trafego_campanhas (idempotente via external_campaign_id)
// 3. Pra cada campanha, busca insights do range pedido
// 4. Upsert métricas em trafego_metricas_diarias

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  listCampaigns,
  debugListCampaigns,
  getCampaignInsights,
  MetaApiError,
  normalizeAdAccountId,
  type MetaCampaign,
  type MetaInsightDay,
} from "./meta-api";

export interface SyncResult {
  ok: boolean;
  client_id: string;
  client_nome?: string;
  campaigns_found: number;
  campaigns_upserted: number;
  metrics_upserted: number;
  error?: string;
  error_kind?: string;
  /** Diagnóstico legível do que a Graph API retornou (contagens + amostra). */
  debug?: string;
}

/** Métricas básicas que o sistema sincroniza (Fase 2). */
const METRICAS_KEYS = [
  "spend",
  "impressions",
  "reach",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "frequency",
] as const;

function todayISO(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function daysAgoISO(n: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - n);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Mapeia status do Meta pra status interno do sistema.
 * Status interno: 'rascunho' | 'ativa' | 'pausada' | 'finalizada' | 'rejeitada'
 */
function mapMetaStatus(metaCampaign: MetaCampaign): string {
  const eff = metaCampaign.effective_status;
  if (eff === "ACTIVE") return "ativa";
  if (eff === "PAUSED") return "pausada";
  if (eff === "DELETED" || eff === "ARCHIVED") return "finalizada";
  if (eff === "DISAPPROVED" || eff === "WITH_ISSUES") return "rejeitada";
  if (eff === "PENDING_REVIEW" || eff === "IN_PROCESS") return "rascunho";
  return "rascunho";
}

/** Converte budget Meta (centavos como string) pra reais (number). */
function parseBudget(raw: string | undefined): number | null {
  if (!raw) return null;
  const cents = parseInt(raw, 10);
  if (Number.isNaN(cents)) return null;
  return cents / 100;
}

/**
 * Sync MAIN function. Por cliente:
 * 1) Lista campanhas no Meta
 * 2) Upsert em trafego_campanhas (mantém id local, idempotente via external_campaign_id)
 * 3) Pra cada campanha, busca insights dos últimos `daysBack` dias
 * 4) Upsert métricas em trafego_metricas_diarias
 *
 * Retorna estatística do que rolou + erro se houve.
 */
export async function syncMetaForClient(
  clientId: string,
  options: { daysBack?: number } = {},
): Promise<SyncResult> {
  const daysBack = options.daysBack ?? 7;
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const result: SyncResult = {
    ok: false,
    client_id: clientId,
    campaigns_found: 0,
    campaigns_upserted: 0,
    metrics_upserted: 0,
  };

  // 1) Confirma cliente + ad_account_id
  const { data: cliente } = await sb
    .from("clients")
    .select("id, nome, organization_id, meta_ad_account_id")
    .eq("id", clientId)
    .single();
  if (!cliente) {
    result.error = "Cliente não encontrado";
    result.error_kind = "client_not_found";
    return result;
  }
  result.client_nome = cliente.nome;

  if (!cliente.meta_ad_account_id) {
    result.error = "Cliente sem meta_ad_account_id cadastrado";
    result.error_kind = "no_meta_account_id";
    await markClientSyncError(sb, clientId, result.error_kind);
    return result;
  }

  // 2) Busca campanhas no Meta
  let metaCampaigns: MetaCampaign[];
  try {
    metaCampaigns = await listCampaigns(cliente.meta_ad_account_id);
  } catch (e) {
    if (e instanceof MetaApiError) {
      result.error = e.message;
      result.error_kind = e.kind;
    } else {
      result.error = String(e);
      result.error_kind = "api_error";
    }
    await markClientSyncError(sb, clientId, result.error_kind);
    return result;
  }
  result.campaigns_found = metaCampaigns.length;

  // 2b) Diagnóstico: SEMPRE popula result.debug com o que a Graph API retornou
  // (contagem com/sem filtro + amostra). Nunca expõe o token. Se o diagnóstico
  // em si falhar, registra o motivo — mas não aborta o sync.
  const accountLabel = normalizeAdAccountId(cliente.meta_ad_account_id);
  try {
    const diag = await debugListCampaigns(cliente.meta_ad_account_id);
    if (diag.comFiltro === 0 && diag.semFiltro === 0) {
      result.debug = `Meta retornou 0 campanhas pra a conta ${accountLabel} (com e sem filtro).`;
    } else {
      const amostraStr =
        diag.amostra.length > 0
          ? diag.amostra.map((c) => `${c.name} [${c.effective_status}]`).join(", ")
          : "—";
      result.debug =
        `Meta: ${diag.comFiltro} campanhas com filtro, ${diag.semFiltro} sem filtro. ` +
        `Amostra: ${amostraStr}`;
    }
  } catch (e) {
    const motivo = e instanceof MetaApiError ? `${e.kind}: ${e.message}` : String(e);
    result.debug = `Diagnóstico do Meta falhou pra a conta ${accountLabel}: ${motivo}`;
  }

  // 3) Upsert campanhas (matching por external_campaign_id)
  // Pega as campanhas internas que JÁ existem pra esse cliente
  const { data: existing } = await sb
    .from("trafego_campanhas")
    .select("id, external_campaign_id")
    .eq("client_id", clientId)
    .eq("plataforma", "meta")
    .is("archived_at", null);
  const existingByExtId = new Map<string, string>();
  for (const r of (existing ?? []) as Array<{ id: string; external_campaign_id: string | null }>) {
    if (r.external_campaign_id) existingByExtId.set(r.external_campaign_id, r.id);
  }

  const nowIso = new Date().toISOString();
  const localCampaignIds: Array<{ local_id: string; external_id: string }> = [];

  for (const meta of metaCampaigns) {
    const status = mapMetaStatus(meta);
    const payload = {
      client_id: clientId,
      organization_id: cliente.organization_id,
      plataforma: "meta",
      nome: meta.name,
      objetivo: meta.objective ?? null,
      status,
      external_account_id: cliente.meta_ad_account_id,
      external_campaign_id: meta.id,
      budget_diario: parseBudget(meta.daily_budget),
      budget_total: parseBudget(meta.lifetime_budget),
      data_inicio: meta.start_time?.slice(0, 10) ?? null,
      data_fim: meta.stop_time?.slice(0, 10) ?? null,
      meta_synced_at: nowIso,
    };

    const existingId = existingByExtId.get(meta.id);
    if (existingId) {
      const { error } = await sb
        .from("trafego_campanhas")
        .update(payload)
        .eq("id", existingId);
      if (!error) {
        result.campaigns_upserted++;
        localCampaignIds.push({ local_id: existingId, external_id: meta.id });
      }
    } else {
      const { data: inserted, error } = await sb
        .from("trafego_campanhas")
        .insert(payload)
        .select("id")
        .single();
      if (!error && inserted) {
        result.campaigns_upserted++;
        localCampaignIds.push({ local_id: inserted.id, external_id: meta.id });
      }
    }
  }

  // 4) Pra cada campanha, busca insights e faz upsert das métricas
  const sinceISO = daysAgoISO(daysBack);
  const untilISO = todayISO();

  for (const { local_id, external_id } of localCampaignIds) {
    let insights: MetaInsightDay[];
    try {
      insights = await getCampaignInsights(external_id, sinceISO, untilISO);
    } catch (e) {
      // Se uma campanha falhar, continua com as outras (não aborta o sync)
      console.warn(`[meta-sync] insights failed for ${external_id}:`, e);
      continue;
    }

    for (const day of insights) {
      for (const key of METRICAS_KEYS) {
        const raw = day[key];
        if (raw === undefined || raw === null) continue;
        const numeric = Number(raw);
        if (Number.isNaN(numeric)) continue;

        const { error } = await sb.from("trafego_metricas_diarias").upsert(
          {
            campanha_id: local_id,
            data: day.date_start,
            metrica_key: key,
            valor_numerico: numeric,
            fonte: "meta",
          },
          { onConflict: "campanha_id,data,metrica_key" },
        );
        if (!error) result.metrics_upserted++;
      }
    }
  }

  // 5) Marca sync como bem-sucedido no cliente
  await sb
    .from("clients")
    .update({
      meta_last_sync_at: nowIso,
      meta_last_sync_error: null,
    })
    .eq("id", clientId);

  result.ok = true;
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markClientSyncError(sb: any, clientId: string, errorKind: string): Promise<void> {
  await sb
    .from("clients")
    .update({
      meta_last_sync_at: new Date().toISOString(),
      meta_last_sync_error: errorKind,
    })
    .eq("id", clientId);
}

/** Lista todos os clientes elegíveis pra sync (têm meta_ad_account_id setado). */
export async function listClientesParaSync(): Promise<
  Array<{ id: string; nome: string }>
> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data } = await sb
    .from("clients")
    .select("id, nome")
    .not("meta_ad_account_id", "is", null)
    .neq("meta_ad_account_id", "")
    .eq("status", "ativo")
    .is("deleted_at", null);
  return (data ?? []) as Array<{ id: string; nome: string }>;
}
