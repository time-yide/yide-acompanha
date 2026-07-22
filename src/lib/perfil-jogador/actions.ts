"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizarUsername, validarUsername } from "./username";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Result = { error?: string; success?: boolean };

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function podeEditar(actor: { id: string; role: string }, alvo: string): boolean {
  return actor.id === alvo || canAccess(actor.role, "manage:users");
}

function tags(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(
    raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
  )].slice(0, 12);
}

export async function salvarCardAction(targetUserId: string, formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!podeEditar(actor, targetUserId)) return { error: "Sem permissão" };

  const usernameRaw = String(formData.get("username") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const comoTrabalho = String(formData.get("como_trabalho") ?? "").trim() || null;
  const frase = String(formData.get("frase") ?? "").trim() || null;
  const hobbies = tags(String(formData.get("hobbies") ?? ""));

  const sb = createServiceRoleClient() as SB;

  let username: string | null = null;
  if (usernameRaw) {
    const erro = validarUsername(usernameRaw);
    if (erro) return { error: erro };
    username = normalizarUsername(usernameRaw);
    // Único (case-insensitive), ignorando o próprio.
    const { data: existente } = await sb
      .from("perfil_jogador")
      .select("user_id")
      .eq("username", username)
      .neq("user_id", targetUserId)
      .maybeSingle();
    if (existente) return { error: "Esse username já está em uso." };
  }

  const { error } = await sb
    .from("perfil_jogador")
    .upsert(
      {
        user_id: targetUserId,
        username,
        bio,
        como_trabalho: comoTrabalho,
        frase,
        hobbies,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) return { error: error.message };

  revalidatePath(`/perfil/${targetUserId}`);
  revalidatePath("/time");
  return { success: true };
}

export async function uploadCapaAction(
  targetUserId: string,
  formData: FormData,
): Promise<{ error: string } | { success: true; capaUrl: string }> {
  const actor = await requireAuth();
  if (!podeEditar(actor, targetUserId)) return { error: "Sem permissão" };

  const file = formData.get("capa");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (!ALLOWED.includes(file.type)) return { error: "Apenas JPEG, PNG ou WebP" };
  if (file.size > MAX_BYTES) return { error: "Máximo 4MB" };
  if (file.size === 0) return { error: "Arquivo vazio" };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${targetUserId}/capa.${ext}`;
  const admin = createServiceRoleClient();
  // Reaproveita o bucket público "avatars" (evita criar bucket novo manualmente).
  const { error: upErr } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) return { error: upErr.message };
  const { data: { publicUrl } } = admin.storage.from("avatars").getPublicUrl(path);
  const capaUrl = `${publicUrl}?v=${Date.now()}`;

  const sb = createServiceRoleClient() as SB;
  const { error } = await sb
    .from("perfil_jogador")
    .upsert({ user_id: targetUserId, capa_url: capaUrl, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { error: error.message };

  revalidatePath(`/perfil/${targetUserId}`);
  return { success: true, capaUrl };
}
