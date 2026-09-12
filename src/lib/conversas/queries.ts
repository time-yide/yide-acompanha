// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { WppConversation, WppMessage } from "./types";

export async function listConversations(
  organizationId: string,
  filter: { arquivada?: boolean } = {},
): Promise<WppConversation[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const q = sb
    .from("wpp_conversations")
    .select(
      "id, organization_id, contato_nome, contato_telefone, canal, lead_gerado_id, ultimo_texto, ultima_msg_em, nao_lidas, arquivada, fixada, twilio_from, ai_ativa, ai_config_id, created_at, updated_at, lead:leads_gerados!wpp_conversations_lead_gerado_id_fkey(empresa)",
    )
    .eq("organization_id", organizationId)
    .eq("arquivada", filter.arquivada ?? false)
    .order("fixada", { ascending: false })
    .order("ultima_msg_em", { ascending: false, nullsFirst: false })
    .limit(200);

  const { data, error } = await q;
  if (error) {
    console.error("[conversas] listConversations error:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row: any) => ({
    id: row.id,
    organization_id: row.organization_id,
    contato_nome: row.contato_nome ?? "",
    contato_telefone: row.contato_telefone,
    canal: row.canal ?? "whatsapp",
    lead_gerado_id: row.lead_gerado_id ?? null,
    lead_nome: row.lead?.empresa ?? null,
    ultimo_texto: row.ultimo_texto ?? null,
    ultima_msg_em: row.ultima_msg_em ?? null,
    nao_lidas: row.nao_lidas ?? 0,
    arquivada: row.arquivada ?? false,
    fixada: row.fixada ?? false,
    twilio_from: row.twilio_from ?? null,
    ai_ativa: row.ai_ativa ?? false,
    ai_config_id: row.ai_config_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function getConversation(id: string): Promise<WppConversation | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("wpp_conversations")
    .select(
      "id, organization_id, contato_nome, contato_telefone, canal, lead_gerado_id, ultimo_texto, ultima_msg_em, nao_lidas, arquivada, fixada, twilio_from, ai_ativa, ai_config_id, created_at, updated_at, lead:leads_gerados!wpp_conversations_lead_gerado_id_fkey(empresa)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  return {
    id: row.id,
    organization_id: row.organization_id,
    contato_nome: row.contato_nome ?? "",
    contato_telefone: row.contato_telefone,
    canal: row.canal ?? "whatsapp",
    lead_gerado_id: row.lead_gerado_id ?? null,
    lead_nome: row.lead?.empresa ?? null,
    ultimo_texto: row.ultimo_texto ?? null,
    ultima_msg_em: row.ultima_msg_em ?? null,
    nao_lidas: row.nao_lidas ?? 0,
    arquivada: row.arquivada ?? false,
    fixada: row.fixada ?? false,
    twilio_from: row.twilio_from ?? null,
    ai_ativa: row.ai_ativa ?? false,
    ai_config_id: row.ai_config_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listMessages(
  conversationId: string,
  limit = 100,
): Promise<WppMessage[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("wpp_messages")
    .select("id, conversation_id, autor, texto, media_url, media_type, twilio_sid, status, enviado_por, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[conversas] listMessages error:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row: any) => ({
    id: row.id,
    conversation_id: row.conversation_id,
    autor: row.autor,
    texto: row.texto ?? "",
    media_url: row.media_url ?? null,
    media_type: row.media_type ?? null,
    twilio_sid: row.twilio_sid ?? null,
    status: row.status ?? "enviada",
    enviado_por: row.enviado_por ?? null,
    created_at: row.created_at,
  }));
}

export async function getOrganizationIdByUser(userId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.organization_id ?? null;
}
