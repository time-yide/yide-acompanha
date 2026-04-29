"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function uploadAvatarAction(
  targetUserId: string,
  formData: FormData,
): Promise<{ error: string } | { success: true; avatarUrl: string }> {
  const actor = await requireAuth();

  const canEdit = actor.id === targetUserId || canAccess(actor.role, "edit:colaboradores");
  if (!canEdit) return { error: "Sem permissão" };

  const file = formData.get("avatar");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (!ALLOWED.includes(file.type)) return { error: "Apenas JPEG, PNG ou WebP" };
  if (file.size > MAX_BYTES) return { error: "Máximo 2MB" };
  if (file.size === 0) return { error: "Arquivo vazio" };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${targetUserId}/avatar.${ext}`;
  const admin = createServiceRoleClient();

  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) return { error: uploadErr.message };

  const {
    data: { publicUrl },
  } = admin.storage.from("avatars").getPublicUrl(path);
  const urlWithBust = `${publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ avatar_url: urlWithBust })
    .eq("id", targetUserId);
  if (updateErr) return { error: updateErr.message };

  await logAudit({
    entidade: "profiles",
    entidade_id: targetUserId,
    acao: "update",
    dados_depois: { avatar_url: urlWithBust },
    ator_id: actor.id,
  });

  revalidatePath(`/colaboradores/${targetUserId}`);
  revalidatePath("/colaboradores");
  if (actor.id === targetUserId) {
    revalidatePath("/configuracoes");
    revalidatePath("/", "layout");
  }
  return { success: true, avatarUrl: urlWithBust };
}
