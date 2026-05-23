"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";

const TUTORIAL_SETORES = [
  "adm",
  "socio",
  "comercial",
  "coordenador",
  "assessor",
  "videomaker",
  "designer",
  "editor",
  "audiovisual_chefe",
] as const;

const createSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório").max(200),
  descricao: z.string().max(2000).optional().nullable(),
  setor: z.enum(TUTORIAL_SETORES).nullable(),
  video_url: z.string().url("URL inválida").max(500),
  ordem: z.number().int().min(0).max(9999).default(0),
});

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
});

const deleteSchema = z.object({ id: z.string().uuid() });

type ActionResult = { error?: string; success?: boolean };

function canManage(role: string): boolean {
  return ["adm", "socio"].includes(role);
}

function parseBody(formData: FormData) {
  const setorRaw = formData.get("setor");
  const setor =
    !setorRaw || setorRaw === "" || setorRaw === "geral"
      ? null
      : (String(setorRaw) as (typeof TUTORIAL_SETORES)[number]);
  return {
    titulo: String(formData.get("titulo") ?? ""),
    descricao: formData.get("descricao") ? String(formData.get("descricao")) : null,
    setor,
    video_url: String(formData.get("video_url") ?? ""),
    ordem: Number(formData.get("ordem") ?? 0),
  };
}

export async function createTutorialAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) {
    return { error: "Apenas ADM/Sócio podem cadastrar tutoriais" };
  }
  const parsed = createSchema.safeParse(parseBody(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data: inserted, error } = await sb
    .from("manual_tutoriais")
    .insert({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      setor: parsed.data.setor,
      video_url: parsed.data.video_url,
      ordem: parsed.data.ordem,
      uploaded_by: actor.id,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return { error: error?.message ?? "Falha ao registrar tutorial" };
  }

  await logAudit({
    entidade: "manual_tutoriais",
    entidade_id: inserted.id,
    acao: "create",
    dados_depois: parsed.data,
    ator_id: actor.id,
  });

  revalidatePath("/manual/passo-a-passo");
  return { success: true };
}

export async function updateTutorialAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) {
    return { error: "Apenas ADM/Sócio podem editar tutoriais" };
  }
  const parsed = updateSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    ...parseBody(formData),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { error } = await sb
    .from("manual_tutoriais")
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      setor: parsed.data.setor,
      video_url: parsed.data.video_url,
      ordem: parsed.data.ordem,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "manual_tutoriais",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_depois: parsed.data,
    ator_id: actor.id,
  });

  revalidatePath("/manual/passo-a-passo");
  return { success: true };
}

export async function deleteTutorialAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) {
    return { error: "Apenas ADM/Sócio podem excluir tutoriais" };
  }
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "ID inválido" };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data: prev } = await sb
    .from("manual_tutoriais")
    .select("titulo")
    .eq("id", parsed.data.id)
    .single();
  const { error } = await sb
    .from("manual_tutoriais")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "manual_tutoriais",
    entidade_id: parsed.data.id,
    acao: "delete",
    dados_antes: prev ? { titulo: (prev as { titulo: string }).titulo } : {},
    ator_id: actor.id,
  });

  revalidatePath("/manual/passo-a-passo");
  return { success: true };
}
