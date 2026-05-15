"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { createCursoExternoSchema, updateCursoExternoSchema } from "./schema";
import { CURSOS_EXTERNOS_TAG } from "./queries";

type ActionResult = { error?: string; success?: boolean };

function isPrivileged(role: string): boolean {
  return role === "adm" || role === "socio" || role === "coordenador";
}

function fd(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === "") return undefined;
  return String(v);
}

export async function createCursoExternoAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!isPrivileged(actor.role)) {
    return { error: "Apenas ADM, Sócio ou Coordenador podem cadastrar cursos online" };
  }

  const parsed = createCursoExternoSchema.safeParse({
    nome: fd(formData, "nome"),
    plataforma: fd(formData, "plataforma"),
    link: fd(formData, "link") ?? "",
    email_acesso: fd(formData, "email_acesso"),
    senha_acesso: fd(formData, "senha_acesso"),
    descricao: fd(formData, "descricao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const insertPayload = {
    organization_id: org.id,
    nome: parsed.data.nome,
    plataforma: parsed.data.plataforma,
    link: parsed.data.link || null,
    email_acesso: parsed.data.email_acesso ?? null,
    senha_acesso: parsed.data.senha_acesso ?? null,
    descricao: parsed.data.descricao ?? null,
    criado_por: actor.id,
  };
  const { data: created, error } = await sb
    .from("cursos_externos")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao cadastrar curso" };

  await logAudit({
    entidade: "cursos_externos",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/academy/cursos-online");
  revalidateTag(CURSOS_EXTERNOS_TAG, "default");
  return { success: true };
}

export async function updateCursoExternoAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!isPrivileged(actor.role)) {
    return { error: "Apenas ADM, Sócio ou Coordenador podem editar cursos online" };
  }

  const parsed = updateCursoExternoSchema.safeParse({
    id: fd(formData, "id"),
    nome: fd(formData, "nome"),
    plataforma: fd(formData, "plataforma"),
    link: fd(formData, "link") ?? "",
    email_acesso: fd(formData, "email_acesso"),
    senha_acesso: fd(formData, "senha_acesso"),
    descricao: fd(formData, "descricao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const updatePayload = {
    nome: parsed.data.nome,
    plataforma: parsed.data.plataforma,
    link: parsed.data.link || null,
    email_acesso: parsed.data.email_acesso ?? null,
    senha_acesso: parsed.data.senha_acesso ?? null,
    descricao: parsed.data.descricao ?? null,
  };
  const { error } = await sb
    .from("cursos_externos")
    .update(updatePayload)
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "cursos_externos",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/academy/cursos-online");
  revalidateTag(CURSOS_EXTERNOS_TAG, "default");
  return { success: true };
}

export async function deleteCursoExternoAction(id: string): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!isPrivileged(actor.role)) {
    return { error: "Apenas ADM, Sócio ou Coordenador podem excluir cursos online" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("cursos_externos").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "cursos_externos",
    entidade_id: id,
    acao: "delete",
    ator_id: actor.id,
  });

  revalidatePath("/academy/cursos-online");
  revalidateTag(CURSOS_EXTERNOS_TAG, "default");
  return { success: true };
}
