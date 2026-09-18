"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

interface ActionResult { success?: true; error?: string }

export async function savePowerDialerConfigAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) return { error: "Sem permissão" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  // Resolve a org do ator server-side (não confia no configId do client)
  const { data: profile } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .single();
  if (!profile) return { error: "Perfil não encontrado" };
  const orgId = profile.organization_id;

  const colaboradorId = (formData.get("power_dialer_colaborador_id") as string) || null;

  // Valida que o colaborador pertence à mesma org
  if (colaboradorId) {
    const { data: colabProfile } = await sb
      .from("profiles")
      .select("id")
      .eq("id", colaboradorId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!colabProfile) return { error: "Colaborador não pertence a esta organização" };
  }

  const payload = {
    power_dialer_ativo: formData.get("power_dialer_ativo") === "true",
    power_dialer_batch_size: Math.min(5, Math.max(1, parseInt(formData.get("power_dialer_batch_size") as string) || 3)),
    power_dialer_timeout_s: Math.min(30, Math.max(5, parseInt(formData.get("power_dialer_timeout_s") as string) || 15)),
    power_dialer_colaborador_id: colaboradorId,
    power_dialer_greeting: (formData.get("power_dialer_greeting") as string)?.trim() || "Olá, tudo bem? Só um momento...",
    power_dialer_goodbye: (formData.get("power_dialer_goodbye") as string)?.trim() || "Desculpe, vamos retornar em breve, obrigada!",
  };

  // Scopa update pela org do ator (previne IDOR cross-tenant)
  const { error } = await sb
    .from("ai_voice_configs")
    .update(payload)
    .eq("organization_id", orgId)
    .eq("ativo", true);

  if (error) return { error: error.message };

  revalidatePath("/configuracoes/voz-ia");
  return { success: true };
}
