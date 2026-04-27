"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import type { Database } from "@/types/database";

type EventType = Database["public"]["Enums"]["notification_event"];

export async function updateRuleAction(formData: FormData) {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:users")) {
    return { error: "Sem permissão" };
  }

  const evento_tipo = String(formData.get("evento_tipo") ?? "") as EventType;
  if (!evento_tipo) return { error: "Tipo de evento inválido" };

  const ativo = formData.get("ativo") === "on";
  const mandatory = formData.get("mandatory") === "on";
  const email_default = formData.get("email_default") === "on";
  const permite_destinatarios_extras = formData.get("permite_destinatarios_extras") === "on";
  const default_roles = (formData.getAll("default_roles") as string[]).filter(Boolean);
  const default_user_ids = (formData.getAll("default_user_ids") as string[]).filter(Boolean);

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("notification_rules")
    .select("*")
    .eq("evento_tipo", evento_tipo)
    .single();
  if (!before) return { error: "Regra não encontrada" };

  const updatePayload = {
    ativo,
    mandatory,
    email_default,
    permite_destinatarios_extras,
    default_roles,
    default_user_ids,
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("notification_rules")
    .update(updatePayload)
    .eq("evento_tipo", evento_tipo);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "notification_rules",
    entidade_id: evento_tipo,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/configuracoes/notificacoes");
  return { success: true };
}

export async function setPreferenceAction(formData: FormData) {
  const actor = await requireAuth();
  const evento_tipo = String(formData.get("evento_tipo") ?? "") as EventType;
  const in_app = formData.get("in_app") === "on";
  const email = formData.get("email") === "on";

  if (!evento_tipo) return { error: "Tipo de evento inválido" };

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("notification_preferences")
    .upsert(
      { user_id: actor.id, evento_tipo, in_app, email, updated_at: new Date().toISOString() },
      { onConflict: "user_id,evento_tipo" },
    );
  if (error) return { error: error.message };

  revalidatePath("/configuracoes/notificacoes");
  return { success: true };
}

export async function getMyPreferencesAction() {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("evento_tipo, in_app, email")
    .eq("user_id", actor.id);
  const map = new Map<EventType, { in_app: boolean; email: boolean }>();
  ((data ?? []) as Array<{ evento_tipo: EventType; in_app: boolean; email: boolean }>).forEach((p) => {
    map.set(p.evento_tipo, { in_app: p.in_app, email: p.email });
  });
  return map;
}
