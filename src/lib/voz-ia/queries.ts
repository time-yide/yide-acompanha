import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { AIVoiceConfig, AIVoiceCall } from "./types";

export async function getActiveConfig(orgId: string): Promise<AIVoiceConfig | null> {
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("ai_voice_configs")
    .select("*")
    .eq("organization_id", orgId)
    .eq("ativo", true)
    .maybeSingle();
  return data ?? null;
}

export async function getCallById(callId: string): Promise<AIVoiceCall | null> {
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("ai_voice_calls")
    .select("*")
    .eq("id", callId)
    .maybeSingle();
  return data ?? null;
}

export async function listCallsForLead(
  leadId: string,
  limit = 20,
): Promise<AIVoiceCall[]> {
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("ai_voice_calls")
    .select("*")
    .eq("lead_gerado_id", leadId)
    .order("criado_em", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getLeadAIStatus(leadId: string) {
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("leads_gerados")
    .select("ai_tentativas, ai_proxima_tentativa, ai_status, telefone, whatsapp, empresa")
    .eq("id", leadId)
    .single();
  return data;
}
