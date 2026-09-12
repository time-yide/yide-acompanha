"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLES_CONFIG_VOZ_IA } from "./types";

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

export async function saveVoiceConfigAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!ROLES_CONFIG_VOZ_IA.includes(actor.role)) return { error: "Sem permissão" };

  const sb = createServiceRoleClient() as any;
  const { data: profile } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .single();
  if (!profile) return { error: "Perfil não encontrado" };
  const orgId = profile.organization_id;

  const systemPrompt = formData.get("system_prompt") as string;
  if (!systemPrompt?.trim()) return { error: "Prompt é obrigatório" };

  const payload = {
    organization_id: orgId,
    nome: (formData.get("nome") as string)?.trim() || "Padrão",
    system_prompt: systemPrompt.trim(),
    voz: (formData.get("voz") as string) || "alloy",
    temperatura: parseFloat((formData.get("temperatura") as string) || "0.8"),
    duracao_max_segundos: parseInt((formData.get("duracao_max_segundos") as string) || "180"),
    wpp_followup_ativo: formData.get("wpp_followup_ativo") === "true",
    wpp_followup_template: (formData.get("wpp_followup_template") as string)?.trim() || null,
    max_tentativas: parseInt((formData.get("max_tentativas") as string) || "7"),
    tentativas_por_semana: parseInt((formData.get("tentativas_por_semana") as string) || "2"),
    motor_ativo: formData.get("motor_ativo") === "true",
    max_wpp_dia: parseInt((formData.get("max_wpp_dia") as string) || "50"),
    max_chamadas_dia: parseInt((formData.get("max_chamadas_dia") as string) || "30"),
    horario_inicio: (formData.get("horario_inicio") as string) || "08:00",
    horario_fim: (formData.get("horario_fim") as string) || "18:00",
    horario_inicio_fds: (formData.get("horario_inicio_fds") as string) || "09:00",
    horario_fim_fds: (formData.get("horario_fim_fds") as string) || "17:00",
    wpp_primeiro_contato_prompt: (formData.get("wpp_primeiro_contato_prompt") as string)?.trim() || null,
    wpp_system_prompt: (formData.get("wpp_system_prompt") as string)?.trim() || null,
    twilio_wpp_from: (formData.get("twilio_wpp_from") as string)?.trim() || null,
    ativo: true,
    updated_at: new Date().toISOString(),
  };

  const existingId = formData.get("id") as string;
  if (existingId) {
    const { error } = await sb
      .from("ai_voice_configs")
      .update(payload)
      .eq("id", existingId)
      .eq("organization_id", orgId);
    if (error) return { error: error.message };
  } else {
    const { error } = await sb.from("ai_voice_configs").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath("/configuracoes/voz-ia");
  return { success: true };
}
