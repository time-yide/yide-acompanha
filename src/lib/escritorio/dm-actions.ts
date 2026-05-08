"use server";

import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { ESCRITORIO_UNREAD_TAG } from "./queries";

interface DmResult {
  channelId?: string;
  error?: string;
}

/**
 * Cria ou retorna o DM channel entre actor e targetUserId. Idempotente:
 * se já existe DM entre os 2, retorna o ID. Caso contrário cria.
 *
 * Permissão: any-to-any. Mas valida que target é profile ativo (defense
 * in depth).
 *
 * Race: 2 abas abrindo DM ao mesmo tempo — unique index garante que só 1
 * vence; se a 2ª falhar no INSERT por conflict, retry busca o existente.
 */
export async function openOrCreateDmAction(targetUserId: string): Promise<DmResult> {
  const actor = await requireAuth();
  if (actor.id === targetUserId) {
    return { error: "Você não pode iniciar conversa com você mesmo" };
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: target } = await sb
    .from("profiles")
    .select("id, ativo")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!target || !target.ativo) {
    return { error: "Usuário não encontrado ou inativo" };
  }

  // Tenta achar DM existente
  const { data: existing } = await sb
    .from("chat_channels")
    .select("id")
    .eq("kind", "direct")
    .contains("member_ids", [actor.id])
    .contains("member_ids", [targetUserId])
    .maybeSingle();
  if (existing) return { channelId: existing.id };

  // Cria novo
  const { data: created, error } = await sb
    .from("chat_channels")
    .insert({
      kind: "direct",
      nome: "",
      descricao: null,
      ordem: 9999,
      member_ids: [actor.id, targetUserId],
    })
    .select("id")
    .single();

  if (error) {
    // Pode ser violação do unique index (race). Re-tenta buscar.
    const { data: retryExisting } = await sb
      .from("chat_channels")
      .select("id")
      .eq("kind", "direct")
      .contains("member_ids", [actor.id])
      .contains("member_ids", [targetUserId])
      .maybeSingle();
    if (retryExisting) return { channelId: retryExisting.id };
    return { error: error.message };
  }

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  return { channelId: created.id };
}
