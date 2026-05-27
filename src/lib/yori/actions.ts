"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getEffectiveUnitId } from "@/lib/units/session";
import { createTemplateSchema, updateTemplateSchema, createJobSchema, markDownloadSchema } from "./schema";
import { isYoriEnabled, canUseYori } from "./feature-flag";
import { uploadVideo, deleteFile } from "./storage";
import { countJobsThisMonth, getJob } from "./queries";

type ActionOk<T = void> = { success: true; data?: T };
type ActionErr = { error: string };
type ActionResult<T = void> = ActionOk<T> | ActionErr;

async function requireYoriAccess() {
  const user = await requireAuth();
  if (!canUseYori(user.role)) redirect("/audiovisual");
  if (!isYoriEnabled()) redirect("/audiovisual");
  return user;
}

// === Templates ===

export async function createYoriTemplateAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireYoriAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = Object.fromEntries(formData);
  raw.has_shadow = raw.has_shadow === "true" || raw.has_shadow === "on";
  const parsed = createTemplateSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return { error: "Organização não encontrada" };

  const { data, error } = await sb.from("yori_templates").insert({
    ...parsed.data,
    user_id: user.id,
    organization_id: profile.organization_id,
    is_system: false,
  }).select("id").single();
  if (error) return { error: error.message };

  revalidatePath("/audiovisual/yori/templates");
  return { success: true, data: { id: data.id as string } };
}

export async function updateYoriTemplateAction(formData: FormData): Promise<ActionResult> {
  const user = await requireYoriAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = Object.fromEntries(formData);
  raw.has_shadow = raw.has_shadow === "true" || raw.has_shadow === "on";
  const parsed = updateTemplateSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: existing } = await sb.from("yori_templates").select("user_id, is_system").eq("id", parsed.data.id).maybeSingle();
  if (!existing) return { error: "Template não encontrado" };
  if (existing.is_system) return { error: "Templates de sistema não podem ser editados" };
  if (existing.user_id !== user.id) return { error: "Você não pode editar template de outro usuário" };

  const { id, ...updateData } = parsed.data;
  const { error } = await sb.from("yori_templates").update(updateData).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/audiovisual/yori/templates");
  return { success: true };
}

export async function deleteYoriTemplateAction(templateId: string): Promise<ActionResult> {
  const user = await requireYoriAccess();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: existing } = await sb.from("yori_templates").select("user_id, is_system").eq("id", templateId).maybeSingle();
  if (!existing) return { error: "Template não encontrado" };
  if (existing.is_system) return { error: "Templates de sistema não podem ser deletados" };
  if (existing.user_id !== user.id) return { error: "Você não pode deletar template de outro usuário" };

  const { error } = await sb.from("yori_templates").delete().eq("id", templateId);
  if (error) return { error: error.message };

  revalidatePath("/audiovisual/yori/templates");
  return { success: true };
}

// === Jobs ===

export async function createYoriJobAction(formData: FormData): Promise<ActionResult<{ jobId: string }>> {
  const user = await requireYoriAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = Object.fromEntries(formData);
  const parsed = createJobSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const file = formData.get("video") as File | null;
  if (!file || file.size === 0) return { error: "Vídeo não enviado" };
  if (file.size !== parsed.data.video_size_bytes) {
    return { error: "Tamanho do arquivo não bate com declarado" };
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return { error: "Organização não encontrada" };

  const count = await countJobsThisMonth(profile.organization_id);
  if (count >= 100) return { error: "Quota mensal de 100 vídeos atingida. Reset no dia 1." };

  const unitId = await getEffectiveUnitId();

  const { data: job, error: insertError } = await sb.from("yori_jobs").insert({
    organization_id: profile.organization_id,
    unit_id: unitId,
    user_id: user.id,
    template_id: parsed.data.template_id,
    video_filename: parsed.data.video_filename,
    video_duration_seconds: parsed.data.video_duration_seconds,
    video_size_bytes: parsed.data.video_size_bytes,
    status: "pending",
  }).select("id").single();
  if (insertError || !job) return { error: insertError?.message ?? "Erro ao criar job" };

  const buffer = await file.arrayBuffer();
  const uploadResult = await uploadVideo(
    profile.organization_id,
    user.id,
    job.id as string,
    parsed.data.video_filename,
    buffer,
    file.type || "video/mp4",
  );
  if (!uploadResult.ok) {
    await sb.from("yori_jobs").update({
      status: "error",
      error_message: `Upload falhou: ${uploadResult.error}`,
    }).eq("id", job.id);
    return { error: uploadResult.error };
  }

  await sb.from("yori_jobs").update({ video_path: uploadResult.path }).eq("id", job.id);

  revalidatePath("/audiovisual/yori");
  revalidateTag("yori-undownloaded", "default");
  return { success: true, data: { jobId: job.id as string } };
}

export async function markYoriJobDownloadedAction(formData: FormData): Promise<ActionResult> {
  const user = await requireYoriAccess();
  const parsed = markDownloadSchema.safeParse({
    jobId: formData.get("jobId"),
    type: formData.get("type"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const job = await getJob(parsed.data.jobId);
  if (!job) return { error: "Job não encontrado" };
  if (job.user_id !== user.id) return { error: "Acesso negado" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb.from("yori_jobs").update({ downloaded_at: new Date().toISOString() }).eq("id", parsed.data.jobId);

  revalidatePath("/audiovisual/yori");
  revalidateTag("yori-undownloaded", "default");
  return { success: true };
}

export async function cancelYoriJobAction(jobId: string): Promise<ActionResult> {
  const user = await requireYoriAccess();
  const job = await getJob(jobId);
  if (!job) return { error: "Job não encontrado" };
  if (job.user_id !== user.id) return { error: "Acesso negado" };
  if (job.status !== "pending") return { error: "Só dá pra cancelar jobs pendentes" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb.from("yori_jobs").update({ status: "cancelled" }).eq("id", jobId);

  if (job.video_path) {
    await deleteFile("yori-videos", job.video_path);
  }

  revalidatePath("/audiovisual/yori");
  return { success: true };
}
