"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import {
  createCampanhaSchema,
  updateCampanhaSchema,
  archiveCampanhaSchema,
  updateMetricasVisiveisSchema,
  updateClienteAdAccountsSchema,
} from "./schema";
import { METRICA_KEYS } from "./metricas";
import { syncMetaForClient } from "./meta-sync";

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

const ROLES_QUE_GERENCIAM = [
  "adm", "socio", "comercial", "coordenador", "assessor",
] as const;

function canManage(role: string): boolean {
  return (ROLES_QUE_GERENCIAM as readonly string[]).includes(role);
}

function fd(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

export async function createCampanhaAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão pra criar campanha" };

  const parsed = createCampanhaSchema.safeParse({
    client_id: fd(formData, "client_id"),
    plataforma: fd(formData, "plataforma"),
    nome: fd(formData, "nome"),
    objetivo: fd(formData, "objetivo"),
    status: fd(formData, "status") ?? "rascunho",
    budget_diario: fd(formData, "budget_diario"),
    budget_total: fd(formData, "budget_total"),
    link_destino: fd(formData, "link_destino"),
    copy: fd(formData, "copy"),
    publico_alvo: fd(formData, "publico_alvo"),
    criativo_url: fd(formData, "criativo_url"),
    data_inicio: fd(formData, "data_inicio"),
    data_fim: fd(formData, "data_fim"),
    observacoes: fd(formData, "observacoes"),
    external_account_id: fd(formData, "external_account_id"),
    external_campaign_id: fd(formData, "external_campaign_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  // Pega organization_id do cliente
  const { data: client } = await supabase
    .from("clients")
    .select("organization_id")
    .eq("id", parsed.data.client_id)
    .single();
  if (!client) return { error: "Cliente não encontrado" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("trafego_campanhas").insert({
    organization_id: (client as { organization_id: string }).organization_id,
    client_id: parsed.data.client_id,
    plataforma: parsed.data.plataforma,
    nome: parsed.data.nome,
    objetivo: parsed.data.objetivo,
    status: parsed.data.status,
    budget_diario: parsed.data.budget_diario,
    budget_total: parsed.data.budget_total,
    link_destino: parsed.data.link_destino,
    copy: parsed.data.copy,
    publico_alvo: parsed.data.publico_alvo,
    criativo_url: parsed.data.criativo_url,
    data_inicio: parsed.data.data_inicio,
    data_fim: parsed.data.data_fim,
    observacoes: parsed.data.observacoes,
    external_account_id: parsed.data.external_account_id,
    external_campaign_id: parsed.data.external_campaign_id,
    created_by: actor.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/trafego");
  revalidatePath(`/trafego/${parsed.data.client_id}`);
  return { success: true };
}

export async function updateCampanhaAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão pra editar campanha" };

  const parsed = updateCampanhaSchema.safeParse({
    id: fd(formData, "id"),
    client_id: fd(formData, "client_id"),
    plataforma: fd(formData, "plataforma"),
    nome: fd(formData, "nome"),
    objetivo: fd(formData, "objetivo"),
    status: fd(formData, "status") ?? "rascunho",
    budget_diario: fd(formData, "budget_diario"),
    budget_total: fd(formData, "budget_total"),
    link_destino: fd(formData, "link_destino"),
    copy: fd(formData, "copy"),
    publico_alvo: fd(formData, "publico_alvo"),
    criativo_url: fd(formData, "criativo_url"),
    data_inicio: fd(formData, "data_inicio"),
    data_fim: fd(formData, "data_fim"),
    observacoes: fd(formData, "observacoes"),
    external_account_id: fd(formData, "external_account_id"),
    external_campaign_id: fd(formData, "external_campaign_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("trafego_campanhas")
    .update({
      plataforma: parsed.data.plataforma,
      nome: parsed.data.nome,
      objetivo: parsed.data.objetivo,
      status: parsed.data.status,
      budget_diario: parsed.data.budget_diario,
      budget_total: parsed.data.budget_total,
      link_destino: parsed.data.link_destino,
      copy: parsed.data.copy,
      publico_alvo: parsed.data.publico_alvo,
      criativo_url: parsed.data.criativo_url,
      data_inicio: parsed.data.data_inicio,
      data_fim: parsed.data.data_fim,
      observacoes: parsed.data.observacoes,
      external_account_id: parsed.data.external_account_id,
      external_campaign_id: parsed.data.external_campaign_id,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/trafego");
  revalidatePath(`/trafego/${parsed.data.client_id}`);
  return { success: true };
}

export async function archiveCampanhaAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão pra arquivar campanha" };

  const parsed = archiveCampanhaSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("trafego_campanhas")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/trafego");
  return { success: true };
}

/**
 * Atualiza preferência do usuário sobre quais métricas exibir.
 * Filtra métricas inválidas (não constam em METRICA_KEYS).
 */
export async function updateMetricasVisiveisAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();

  // Form envia "metricas" como JSON array stringificado
  let metricas: string[] = [];
  try {
    const raw = formData.get("metricas");
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) metricas = parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    return { error: "Formato inválido" };
  }

  const parsed = updateMetricasVisiveisSchema.safeParse({ metricas });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const validKeys = new Set(METRICA_KEYS);
  const filtered = parsed.data.metricas.filter((k) => validKeys.has(k));

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("profiles")
    .update({ trafego_metricas_visiveis: filtered })
    .eq("id", actor.id);
  if (error) return { error: error.message };

  revalidatePath("/trafego");
  return { success: true };
}

/**
 * Atualiza os IDs de conta de anúncios (Meta + Google) do cliente.
 * Usado pra Fase 2 conseguir mapear cliente → contas reais nas APIs.
 */
export async function updateClienteAdAccountsAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = updateClienteAdAccountsSchema.safeParse({
    client_id: fd(formData, "client_id"),
    meta_ad_account_id: fd(formData, "meta_ad_account_id"),
    google_ads_customer_id: fd(formData, "google_ads_customer_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("clients")
    .update({
      meta_ad_account_id: parsed.data.meta_ad_account_id,
      google_ads_customer_id: parsed.data.google_ads_customer_id,
    })
    .eq("id", parsed.data.client_id);
  if (error) return { error: error.message };

  revalidatePath(`/trafego/${parsed.data.client_id}`);
  return { success: true };
}

// ─── Sync com Meta Ads (botão "Sincronizar agora") ──────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const syncMetaSchema = z.object({
  client_id: z.string().regex(UUID_RE, "ID inválido"),
});

interface SyncMetaResultOk {
  success: true;
  campaigns_found: number;
  campaigns_upserted: number;
  metrics_upserted: number;
}

/**
 * Sincroniza UM cliente sob demanda - chamada do botão "Sincronizar agora"
 * na página /trafego/[clientId].
 *
 * Permite roles que gerenciam tráfego. Demora ~2-10s dependendo de quantas
 * campanhas o cliente tem.
 */
export async function syncMetaForClientAction(
  formData: FormData,
): Promise<SyncMetaResultOk | ActionErr> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = syncMetaSchema.safeParse({ client_id: formData.get("client_id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await syncMetaForClient(parsed.data.client_id, { daysBack: 7 });
  if (!result.ok) {
    return { error: result.error ?? "Falha ao sincronizar" };
  }

  revalidatePath(`/trafego/${parsed.data.client_id}`);
  return {
    success: true,
    campaigns_found: result.campaigns_found,
    campaigns_upserted: result.campaigns_upserted,
    metrics_upserted: result.metrics_upserted,
  };
}
