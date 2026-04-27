"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { createTaskSchema, editTaskSchema } from "./schema";

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}

export async function createTaskAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = createTaskSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    prioridade: fd(formData, "prioridade") || "media",
    atribuido_a: fd(formData, "atribuido_a"),
    client_id: fd(formData, "client_id"),
    due_date: fd(formData, "due_date"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("tasks")
    .insert({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || null,
      prioridade: parsed.data.prioridade,
      atribuido_a: parsed.data.atribuido_a,
      client_id: parsed.data.client_id || null,
      due_date: parsed.data.due_date || null,
      criado_por: actor.id,
    })
    .select("id, client_id")
    .single();

  if (error || !created) return { error: error?.message ?? "Falha ao criar tarefa" };

  revalidatePath("/tarefas");
  if (created.client_id) revalidatePath(`/clientes/${created.client_id}/tarefas`);
  redirect(`/tarefas/${created.id}`);
}

export async function updateTaskAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = editTaskSchema.safeParse({
    id: fd(formData, "id"),
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    prioridade: fd(formData, "prioridade") || "media",
    atribuido_a: fd(formData, "atribuido_a"),
    client_id: fd(formData, "client_id"),
    due_date: fd(formData, "due_date"),
    status: fd(formData, "status") || "aberta",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: before } = await supabase.from("tasks").select("*").eq("id", parsed.data.id).single();
  if (!before) return { error: "Tarefa não encontrada" };

  if (before.criado_por !== actor.id && before.atribuido_a !== actor.id) {
    return { error: "Apenas criador ou responsável podem editar" };
  }

  const completed_at =
    parsed.data.status === "concluida" && before.status !== "concluida"
      ? new Date().toISOString()
      : parsed.data.status !== "concluida"
        ? null
        : before.completed_at;

  const { error } = await supabase
    .from("tasks")
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || null,
      prioridade: parsed.data.prioridade,
      atribuido_a: parsed.data.atribuido_a,
      client_id: parsed.data.client_id || null,
      due_date: parsed.data.due_date || null,
      status: parsed.data.status,
      completed_at,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${parsed.data.id}`);
  if (before.client_id) revalidatePath(`/clientes/${before.client_id}/tarefas`);
  if (parsed.data.client_id && parsed.data.client_id !== before.client_id) {
    revalidatePath(`/clientes/${parsed.data.client_id}/tarefas`);
  }
  redirect(`/tarefas/${parsed.data.id}`);
}

export async function toggleTaskCompletionAction(taskId: string) {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { data: t } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (!t) return { error: "Tarefa não encontrada" };
  if (t.criado_por !== actor.id && t.atribuido_a !== actor.id) {
    return { error: "Sem permissão" };
  }

  const novoStatus = t.status === "concluida" ? "aberta" : "concluida";
  const completed_at = novoStatus === "concluida" ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("tasks")
    .update({ status: novoStatus, completed_at })
    .eq("id", taskId);

  if (error) return { error: error.message };

  revalidatePath("/tarefas");
  if (t.client_id) revalidatePath(`/clientes/${t.client_id}/tarefas`);
  return { success: novoStatus === "concluida" ? "Tarefa concluída" : "Tarefa reaberta" };
}
