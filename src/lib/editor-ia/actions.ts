"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { criarJobSchema, salvarPlanoSchema } from "./schema";
import { isEditorIaEnabled, canUseEditorIa } from "./feature-flag";
import { createSignedUpload } from "./storage";

type ActionOk<T = void> = { success: true; data?: T };
type ActionErr = { error: string };
type ActionResult<T = void> = ActionOk<T> | ActionErr;

export async function requireEditorIaAccess() {
  const user = await requireAuth();
  if (!canUseEditorIa(user.role)) redirect("/audiovisual");
  if (!isEditorIaEnabled()) redirect("/audiovisual");
  return user;
}

export async function iniciarUploadAction(
  formData: FormData,
): Promise<ActionResult<{ jobId: string; path: string; token: string }>> {
  const user = await requireEditorIaAccess();
  const parsed = criarJobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const filename = String(formData.get("filename") ?? "").trim();
  if (!filename) return { error: "Nome do arquivo ausente" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return { error: "Organizacao nao encontrada" };

  const { data: job, error: insErr } = await sb.from("editor_ia_jobs").insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    instrucao: parsed.data.instrucao,
    video_duracao_segundos: parsed.data.video_duracao_segundos,
    status: "enviando",
  }).select("id").single();
  if (insErr || !job) return { error: insErr?.message ?? "Erro ao criar job" };

  const signed = await createSignedUpload(profile.organization_id, user.id, job.id as string, filename);
  if (!signed.ok) {
    await sb.from("editor_ia_jobs").update({ status: "erro", erro: signed.error }).eq("id", job.id);
    return { error: signed.error };
  }
  await sb.from("editor_ia_jobs").update({ video_url: signed.path }).eq("id", job.id);
  return { success: true, data: { jobId: job.id as string, path: signed.path, token: signed.token } };
}

export async function confirmarUploadAction(formData: FormData): Promise<ActionResult> {
  const user = await requireEditorIaAccess();
  const jobId = String(formData.get("jobId") ?? "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: upd, error } = await sb.from("editor_ia_jobs")
    .update({ status: "transcrevendo" })
    .eq("id", jobId).eq("user_id", user.id).eq("status", "enviando")
    .select("id");
  if (error) return { error: error.message };
  if (!upd || upd.length === 0) return { error: "Job nao encontrado" };
  revalidatePath("/audiovisual/editor-ia");
  return { success: true };
}

export async function renderizarAction(formData: FormData): Promise<ActionResult> {
  const user = await requireEditorIaAccess();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "ID ausente" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return { error: "Organização não encontrada" };

  const { data: job, error: fetchErr } = await sb
    .from("editor_ia_jobs")
    .select("id, status, edit_plan")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr.message };
  if (!job) return { error: "Job não encontrado" };
  if (job.status !== "aguardando_revisao") return { error: "Job não está em aguardando_revisao" };
  if (!job.edit_plan) return { error: "edit_plan ausente — salve o plano antes de renderizar" };

  const { error: updErr } = await sb
    .from("editor_ia_jobs")
    .update({ status: "renderizando" })
    .eq("id", id)
    .eq("organization_id", profile.organization_id);
  if (updErr) return { error: updErr.message };

  revalidatePath(`/audiovisual/editor-ia/${id}`);
  return { success: true };
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
