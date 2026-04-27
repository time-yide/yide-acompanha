"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { createEventSchema, editEventSchema } from "./schema";

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}

export async function createEventAction(formData: FormData) {
  const actor = await requireAuth();

  const participantesRaw = formData.getAll("participantes_ids") as string[];
  const parsed = createEventSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    inicio: fd(formData, "inicio"),
    fim: fd(formData, "fim"),
    participantes_ids: participantesRaw.filter(Boolean),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (new Date(parsed.data.fim) <= new Date(parsed.data.inicio)) {
    return { error: "Horário de fim deve ser posterior ao início" };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const insertPayload = {
    organization_id: org.id,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    inicio: parsed.data.inicio,
    fim: parsed.data.fim,
    sub_calendar: "agencia" as const,
    criado_por: actor.id,
    participantes_ids: parsed.data.participantes_ids,
  };

  const { data: created, error } = await supabase
    .from("calendar_events")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao criar evento" };

  await logAudit({
    entidade: "calendar_events",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload,
    ator_id: actor.id,
  });

  revalidatePath("/calendario");
  redirect(`/calendario`);
}

export async function updateEventAction(formData: FormData) {
  const actor = await requireAuth();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { data: before } = await supabase.from("calendar_events").select("*").eq("id", id).single();
  if (!before) return { error: "Evento não encontrado" };

  const participantesRaw = formData.getAll("participantes_ids") as string[];
  const parsed = editEventSchema.safeParse({
    id,
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    inicio: fd(formData, "inicio"),
    fim: fd(formData, "fim"),
    participantes_ids: participantesRaw.filter(Boolean),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (new Date(parsed.data.fim) <= new Date(parsed.data.inicio)) {
    return { error: "Horário de fim deve ser posterior ao início" };
  }

  const updatePayload = {
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    inicio: parsed.data.inicio,
    fim: parsed.data.fim,
    participantes_ids: parsed.data.participantes_ids,
  };

  const { error } = await supabase.from("calendar_events").update(updatePayload).eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "calendar_events",
    entidade_id: id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/calendario");
  revalidatePath(`/calendario/${id}`);
  redirect("/calendario");
}

export async function deleteEventAction(eventId: string) {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", eventId);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "calendar_events",
    entidade_id: eventId,
    acao: "soft_delete",
    ator_id: actor.id,
  });

  revalidatePath("/calendario");
  return { success: "Evento removido" };
}
