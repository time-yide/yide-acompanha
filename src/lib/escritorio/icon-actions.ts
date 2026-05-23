"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";
import { ESCRITORIO_UNREAD_TAG } from "./queries";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const ADMIN_ROLES = new Set(["socio", "adm"]);

type Result = { error: string } | { success: true; iconUrl: string };

/**
 * Upload da foto do canal de grupo. Apenas socio/adm podem chamar.
 * DMs (kind='direct') são rejeitadas - DM usa avatar do outro membro.
 *
 * Bucket: reusa "avatars" (mesmo bucket dos colaboradores) com path
 * "channels/<channel_id>.<ext>" pra isolar.
 */
export async function uploadChannelIconAction(
  channelId: string,
  formData: FormData,
): Promise<Result> {
  const actor = await requireAuth();
  if (!ADMIN_ROLES.has(actor.role)) return { error: "Sem permissão" };

  const file = formData.get("icon");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (!ALLOWED.includes(file.type)) return { error: "Apenas JPEG, PNG ou WebP" };
  if (file.size > MAX_BYTES) return { error: "Máximo 2MB" };
  if (file.size === 0) return { error: "Arquivo vazio" };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: channel } = await sb
    .from("chat_channels")
    .select("id, kind, icon_url")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) return { error: "Canal não encontrado" };
  if (channel.kind === "direct") return { error: "DMs não têm foto custom" };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `channels/${channelId}.${ext}`;
  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) return { error: uploadErr.message };

  const {
    data: { publicUrl },
  } = admin.storage.from("avatars").getPublicUrl(path);
  const urlWithBust = `${publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await sb
    .from("chat_channels")
    .update({ icon_url: urlWithBust })
    .eq("id", channelId);
  if (updateErr) return { error: updateErr.message };

  await logAudit({
    entidade: "chat_channels",
    entidade_id: channelId,
    acao: "update",
    dados_antes: { icon_url: channel.icon_url ?? null } as unknown as Record<string, unknown>,
    dados_depois: { icon_url: urlWithBust } as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  // Sidebar (todos os usuários) precisa pegar a nova foto
  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  revalidatePath("/configuracoes/canais");
  revalidatePath("/escritorio", "layout");
  return { success: true, iconUrl: urlWithBust };
}

/**
 * Remove a foto custom do canal - volta pro fallback (Hash icon).
 */
export async function removeChannelIconAction(channelId: string): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  if (!ADMIN_ROLES.has(actor.role)) return { error: "Sem permissão" };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { error } = await sb
    .from("chat_channels")
    .update({ icon_url: null })
    .eq("id", channelId);
  if (error) return { error: error.message };

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  revalidatePath("/configuracoes/canais");
  revalidatePath("/escritorio", "layout");
  return { success: true };
}
