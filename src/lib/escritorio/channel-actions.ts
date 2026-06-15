"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { ESCRITORIO_UNREAD_TAG } from "./queries";
import { canDeleteChannel, type Channel } from "./types";

interface ChannelActionResult {
  success?: boolean;
  error?: string;
}

export interface DeletedChannel {
  id: string;
  kind: string;
  nome: string;
  deleted_at: string;
}

/** Soft delete de canal fixo. Só sócio. Nunca DM. */
export async function deleteChannelAction(channelId: string): Promise<ChannelActionResult> {
  const actor = await requireAuth();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: channel } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, member_ids, icon_url")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) return { error: "Canal não encontrado" };

  if (!canDeleteChannel(actor.role, channel as unknown as Channel)) {
    return { error: "Apenas sócio pode excluir canais" };
  }

  const { error } = await sb
    .from("chat_channels")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actor.id })
    .eq("id", channelId)
    .is("deleted_at", null);
  if (error) return { error: error.message };

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  revalidatePath("/escritorio");
  return { success: true };
}

/** Restaura um canal soft-deletado. Só sócio. */
export async function restoreChannelAction(channelId: string): Promise<ChannelActionResult> {
  const actor = await requireAuth();
  if (actor.role !== "socio") return { error: "Apenas sócio pode restaurar canais" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("chat_channels")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", channelId)
    .neq("kind", "direct"); // defensivo: DMs nunca são soft-deletados/restaurados
  if (error) return { error: error.message };

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  revalidatePath("/escritorio");
  return { success: true };
}

/** Lista canais soft-deletados (só pro sócio ver/restaurar). */
export async function listDeletedChannels(role: string): Promise<DeletedChannel[]> {
  if (role !== "socio") return [];
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("chat_channels")
    .select("id, kind, nome, deleted_at")
    .neq("kind", "direct")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) {
    // Pré-migration: coluna deleted_at não existe → sem canais excluídos.
    console.warn("[escritorio] listDeletedChannels:", error.message);
    return [];
  }
  return (data ?? []) as DeletedChannel[];
}
