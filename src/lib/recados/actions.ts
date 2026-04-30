"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth, type CurrentUser } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import {
  criarRecadoSchema,
  editarRecadoSchema,
  REACAO_EMOJIS,
  type NotifScope,
} from "./schema";

function fd(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}

function isPrivileged(user: CurrentUser): boolean {
  return user.role === "socio" || user.role === "adm";
}

async function resolveRecipientIds(
  scope: NotifScope,
  autorId: string,
): Promise<string[]> {
  if (scope === "nenhum") return [];

  const admin = createServiceRoleClient();

  if (scope === "todos") {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("ativo", true)
      .neq("id", autorId);
    return (data ?? []).map((r) => r.id);
  }

  // meu_time → SQL function
  const { data, error } = await admin.rpc("recados_team_member_ids", { autor: autorId });
  if (error) {
    console.error("[recados/actions] team rpc error:", error.message);
    return [];
  }
  return ((data ?? []) as string[]).filter((id) => id !== autorId);
}

export async function criarRecadoAction(formData: FormData) {
  const actor = await requireAuth();

  const wantsPermanente = formData.get("permanente") === "on" || formData.get("permanente") === "true";
  if (wantsPermanente && actor.role !== "socio") {
    return { error: "Apenas Sócio pode fixar recados como permanentes" };
  }

  const parsed = criarRecadoSchema.safeParse({
    titulo: fd(formData, "titulo"),
    corpo: fd(formData, "corpo"),
    notif_scope: fd(formData, "notif_scope"),
    permanente: wantsPermanente,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("recados")
    .insert({
      autor_id: actor.id,
      autor_role_snapshot: actor.role,
      titulo: parsed.data.titulo,
      corpo: parsed.data.corpo,
      permanente: parsed.data.permanente,
      notif_scope: parsed.data.notif_scope,
    })
    .select("id, titulo")
    .single();

  if (error || !created) return { error: error?.message ?? "Falha ao criar recado" };

  if (parsed.data.notif_scope !== "nenhum") {
    const recipientIds = await resolveRecipientIds(parsed.data.notif_scope, actor.id);
    if (recipientIds.length > 0) {
      await dispatchNotification({
        evento_tipo: "recado_novo",
        titulo: `Novo recado de ${actor.nome}`,
        mensagem: created.titulo,
        link: `/recados#${created.id}`,
        user_ids_extras: recipientIds,
        source_user_id: actor.id,
      });
    }
  }

  revalidatePath("/recados");
  revalidatePath("/", "layout");
  return { success: true, id: created.id };
}

export async function editarRecadoAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = editarRecadoSchema.safeParse({
    id: fd(formData, "id"),
    titulo: fd(formData, "titulo"),
    corpo: fd(formData, "corpo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("recados")
    .select("autor_id")
    .eq("id", parsed.data.id)
    .single();
  if (!before) return { error: "Recado não encontrado" };

  if (before.autor_id !== actor.id && !isPrivileged(actor)) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase
    .from("recados")
    .update({ titulo: parsed.data.titulo, corpo: parsed.data.corpo })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/recados");
  return { success: true };
}

export async function apagarRecadoAction(recadoId: string) {
  const actor = await requireAuth();
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("recados")
    .select("autor_id")
    .eq("id", recadoId)
    .single();
  if (!r) return { error: "Recado não encontrado" };

  if (r.autor_id !== actor.id && !isPrivileged(actor)) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase.from("recados").delete().eq("id", recadoId);
  if (error) return { error: error.message };

  revalidatePath("/recados");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function arquivarRecadoAction(recadoId: string, arquivar: boolean) {
  const actor = await requireAuth();
  const supabase = await createClient();

  const { data: r } = await supabase.from("recados").select("autor_id").eq("id", recadoId).single();
  if (!r) return { error: "Recado não encontrado" };

  if (r.autor_id !== actor.id && !isPrivileged(actor)) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase.from("recados").update({ arquivado: arquivar }).eq("id", recadoId);
  if (error) return { error: error.message };

  revalidatePath("/recados");
  return { success: true };
}

export async function fixarRecadoAction(recadoId: string, fixar: boolean) {
  const actor = await requireAuth();
  if (actor.role !== "socio") return { error: "Apenas Sócio pode fixar recados" };

  const supabase = await createClient();
  const { error } = await supabase.from("recados").update({ permanente: fixar }).eq("id", recadoId);
  if (error) return { error: error.message };

  revalidatePath("/recados");
  return { success: true };
}

export async function reagirRecadoAction(recadoId: string, emoji: string) {
  const actor = await requireAuth();
  if (!(REACAO_EMOJIS as readonly string[]).includes(emoji)) {
    return { error: "Emoji inválido" };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("recado_reacoes")
    .select("emoji")
    .eq("recado_id", recadoId)
    .eq("user_id", actor.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("recado_reacoes")
      .delete()
      .eq("recado_id", recadoId)
      .eq("user_id", actor.id)
      .eq("emoji", emoji);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("recado_reacoes")
      .insert({ recado_id: recadoId, user_id: actor.id, emoji });
    if (error) return { error: error.message };
  }

  revalidatePath("/recados");
  return { success: true };
}

export async function marcarRecadosVistosAction() {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("recado_visualizacoes")
    .upsert({ user_id: actor.id, last_seen_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}
