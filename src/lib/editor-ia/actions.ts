"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { criarJobSchema, salvarPlanoSchema } from "./schema";
import { isEditorIaEnabled, canUseEditorIa } from "./feature-flag";
import { uploadVideo } from "./storage";

type ActionOk<T = void> = { success: true; data?: T };
type ActionErr = { error: string };
type ActionResult<T = void> = ActionOk<T> | ActionErr;

export async function requireEditorIaAccess() {
  const user = await requireAuth();
  if (!canUseEditorIa(user.role)) redirect("/audiovisual");
  if (!isEditorIaEnabled()) redirect("/audiovisual");
  return user;
}

export async function criarJobAction(
  formData: FormData,
): Promise<ActionResult<{ jobId: string }>> {
  const user = await requireEditorIaAccess();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = Object.fromEntries(formData);
  const parsed = criarJobSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const file = formData.get("video") as File | null;
  if (!file || file.size === 0) return { error: "Video nao enviado" };
  if (file.size > 500 * 1024 * 1024) return { error: "Vídeo maior que 500MB" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: profile } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return { error: "Organizacao nao encontrada" };

  const { data: job, error: insertError } = await sb
    .from("editor_ia_jobs")
    .insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      instrucao: parsed.data.instrucao,
      video_duracao_segundos: parsed.data.video_duracao_segundos,
      status: "enviando",
    })
    .select("id")
    .single();
  if (insertError || !job) return { error: insertError?.message ?? "Erro ao criar job" };

  const buffer = await file.arrayBuffer();
  const uploadResult = await uploadVideo(
    profile.organization_id,
    user.id,
    job.id as string,
    file.name,
    buffer,
    file.type || "video/mp4",
  );

  if (!uploadResult.ok) {
    await sb
      .from("editor_ia_jobs")
      .update({ status: "erro", erro: `Upload falhou: ${uploadResult.error}` })
      .eq("id", job.id);
    return { error: uploadResult.error };
  }

  await sb
    .from("editor_ia_jobs")
    .update({ video_url: uploadResult.path, status: "transcrevendo" })
    .eq("id", job.id);

  revalidatePath("/audiovisual/editor-ia");
  return { success: true, data: { jobId: job.id as string } };
}

export async function salvarPlanoAction(formData: FormData): Promise<ActionResult> {
  const user = await requireEditorIaAccess();
  let edit_plan: unknown = null;
  const raw = formData.get("edit_plan");
  if (typeof raw === "string") { try { edit_plan = JSON.parse(raw); } catch { /* ignore */ } }

  const parsed = salvarPlanoSchema.safeParse({ id: formData.get("id"), edit_plan });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return { error: "Organização não encontrada" };

  // Só salva no próprio job da org
  const { data: upd, error } = await sb.from("editor_ia_jobs")
    .update({ edit_plan: parsed.data.edit_plan })
    .eq("id", parsed.data.id)
    .eq("organization_id", profile.organization_id)
    .select("id");
  if (error) return { error: error.message };
  if (!upd || upd.length === 0) return { error: "Job não encontrado" };

  revalidatePath(`/audiovisual/editor-ia/${parsed.data.id}`);
  return { success: true };
}
