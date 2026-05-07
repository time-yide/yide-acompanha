"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requirePermission, type CurrentUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import {
  createTaskSchema,
  editTaskSchema,
  moveStatusSchema,
  artesEntreguesSchema,
  requestAdjustmentsSchema,
  TASK_FORMATOS,
} from "./schema";

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  if (v === null || v === "") return undefined;
  const s = String(v);
  // Sentinel "_none" do TaskForm: representa "sem valor" pra Selects que
  // não aceitam value="" (Radix Select).
  if (s === "_none") return undefined;
  return s;
}

type ActionResult = { error?: string } | undefined;

function isPrivileged(user: CurrentUser): boolean {
  return user.role === "adm" || user.role === "socio";
}

async function getProfileNameAndActive(supabase: Awaited<ReturnType<typeof createClient>>, profileId: string) {
  const { data } = await supabase.from("profiles").select("nome, ativo").eq("id", profileId).single();
  return data ?? null;
}

/** Serializa array vindo do form (pode vir como string JSON ou múltiplos values). */
function fdArray(formData: FormData, key: string): unknown[] {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function createTaskAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requirePermission("create:tasks");

  const parsed = createTaskSchema.safeParse({
    id: fd(formData, "id"),
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    prioridade: fd(formData, "prioridade") || "media",
    tipo: fd(formData, "tipo") || "geral",
    formatos: fdArray(formData, "formatos").filter((f): f is string =>
      typeof f === "string" && (TASK_FORMATOS as readonly string[]).includes(f),
    ),
    atribuido_a: fd(formData, "atribuido_a"),
    client_id: fd(formData, "client_id"),
    due_date: fd(formData, "due_date"),
    participantes_ids: fdArray(formData, "participantes_ids"),
    links: fdArray(formData, "links"),
    attachment_urls: fdArray(formData, "attachment_urls"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const assignee = await getProfileNameAndActive(supabase, parsed.data.atribuido_a);
  if (!assignee || !assignee.ativo) return { error: "Responsável inválido ou desativado" };

  // Remove o atribuido_a dos participantes (evita duplicação)
  const participantes = parsed.data.participantes_ids.filter((id) => id !== parsed.data.atribuido_a);

  const requiresApproval = parsed.data.tipo === "video" || parsed.data.tipo === "arte";
  const insertPayload = {
    ...(parsed.data.id ? { id: parsed.data.id } : {}),
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    prioridade: parsed.data.prioridade,
    tipo: parsed.data.tipo,
    formatos: requiresApproval ? parsed.data.formatos : [],
    status_aprovacao: requiresApproval ? ("pendente_envio" as const) : null,
    atribuido_a: parsed.data.atribuido_a,
    client_id: parsed.data.client_id || null,
    due_date: parsed.data.due_date || null,
    criado_por: actor.id,
    participantes_ids: participantes,
    links: parsed.data.links,
    attachment_urls: parsed.data.attachment_urls,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: created, error } = await sb
    .from("tasks")
    .insert(insertPayload)
    .select("id, client_id, titulo")
    .single();

  if (error || !created) return { error: error?.message ?? "Falha ao criar tarefa" };

  await logAudit({
    entidade: "tasks",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  await dispatchNotification({
    evento_tipo: "task_assigned",
    titulo: "Nova tarefa atribuída a você",
    mensagem: `${actor.nome} atribuiu: "${created.titulo}"`,
    link: `/tarefas/${created.id}`,
    user_ids_extras: [parsed.data.atribuido_a],
    source_user_id: actor.id,
  });

  // Notificação separada (mais leve) pra atribuídos adicionais
  if (participantes.length > 0) {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "Você foi adicionado a uma tarefa",
      mensagem: `${actor.nome} atribuiu (como participante): "${created.titulo}"`,
      link: `/tarefas/${created.id}`,
      user_ids_extras: participantes,
      source_user_id: actor.id,
    });
  }

  revalidatePath("/tarefas");
  revalidateTag("tasks", "default");
  revalidateTag("dashboard", "default");
  if (created.client_id) revalidatePath(`/clientes/${created.client_id}/tarefas`);
  revalidateTag("dashboard", "default");
  revalidateTag("tasks", "default");
  redirect("/tarefas?toast=criada");
}

export async function updateTaskAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();

  const parsed = editTaskSchema.safeParse({
    id: fd(formData, "id"),
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    prioridade: fd(formData, "prioridade") || "media",
    tipo: fd(formData, "tipo") || "geral",
    formatos: fdArray(formData, "formatos").filter((f): f is string =>
      typeof f === "string" && (TASK_FORMATOS as readonly string[]).includes(f),
    ),
    atribuido_a: fd(formData, "atribuido_a"),
    client_id: fd(formData, "client_id"),
    due_date: fd(formData, "due_date"),
    status: fd(formData, "status") || "aberta",
    participantes_ids: fdArray(formData, "participantes_ids"),
    links: fdArray(formData, "links"),
    attachment_urls: fdArray(formData, "attachment_urls"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: before } = await supabase.from("tasks").select("*").eq("id", parsed.data.id).single();
  if (!before) return { error: "Tarefa não encontrada" };

  const canEdit =
    before.criado_por === actor.id ||
    before.atribuido_a === actor.id ||
    isPrivileged(actor);
  if (!canEdit) return { error: "Sem permissão" };

  const assignee = await getProfileNameAndActive(supabase, parsed.data.atribuido_a);
  if (!assignee || !assignee.ativo) return { error: "Responsável inválido ou desativado" };

  // Three cases:
  // 1. Transitioning to concluida (was not concluida before) → stamp now
  // 2. Status not concluida (reopen or changing to non-complete) → clear stamp
  // 3. Status remains concluida (re-save without status change) → preserve existing stamp
  const completed_at =
    parsed.data.status === "concluida" && before.status !== "concluida"
      ? new Date().toISOString()
      : parsed.data.status !== "concluida"
        ? null
        : before.completed_at;

  const participantes = parsed.data.participantes_ids.filter((id) => id !== parsed.data.atribuido_a);

  // status_aprovacao: bootstrap quando tipo passa a ser video/arte;
  // limpa quando volta pra geral. Caso contrário, preserva o que estava.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beforeAny = before as any;
  const wasApprovalTipo = beforeAny.tipo === "video" || beforeAny.tipo === "arte";
  const isApprovalTipo = parsed.data.tipo === "video" || parsed.data.tipo === "arte";
  const status_aprovacao = isApprovalTipo
    ? (wasApprovalTipo ? beforeAny.status_aprovacao : "pendente_envio")
    : null;

  const updatePayload = {
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    prioridade: parsed.data.prioridade,
    tipo: parsed.data.tipo,
    formatos: isApprovalTipo ? parsed.data.formatos : [],
    status_aprovacao,
    atribuido_a: parsed.data.atribuido_a,
    client_id: parsed.data.client_id || null,
    due_date: parsed.data.due_date || null,
    status: parsed.data.status,
    completed_at,
    participantes_ids: participantes,
    links: parsed.data.links,
    attachment_urls: parsed.data.attachment_urls,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("tasks").update(updatePayload).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "tasks",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  if (parsed.data.atribuido_a !== before.atribuido_a) {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "Nova tarefa atribuída a você",
      mensagem: `${actor.nome} atribuiu: "${parsed.data.titulo}"`,
      link: `/tarefas/${parsed.data.id}`,
      user_ids_extras: [parsed.data.atribuido_a],
      source_user_id: actor.id,
    });
  }

  if (parsed.data.status === "concluida" && before.status !== "concluida") {
    await dispatchNotification({
      evento_tipo: "task_completed",
      titulo: "Tarefa concluída",
      mensagem: `${actor.nome} concluiu: "${parsed.data.titulo}"`,
      link: `/tarefas/${parsed.data.id}`,
      user_ids_extras: [before.criado_por],
      source_user_id: actor.id,
    });
  }

  revalidatePath("/tarefas");
  revalidateTag("tasks", "default");
  revalidateTag("dashboard", "default");
  revalidatePath(`/tarefas/${parsed.data.id}`);
  if (before.client_id) revalidatePath(`/clientes/${before.client_id}/tarefas`);
  if (parsed.data.client_id && parsed.data.client_id !== before.client_id) {
    revalidatePath(`/clientes/${parsed.data.client_id}/tarefas`);
  }
  revalidateTag("dashboard", "default");
  revalidateTag("tasks", "default");
  redirect("/tarefas?toast=atualizada");
}

export async function toggleTaskCompletionAction(
  taskId: string,
  artesEntregues?: number,
) {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { data: t } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (!t) return { error: "Tarefa não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tParticipantes = (t as any).participantes_ids as string[] | null | undefined;
  const canToggle =
    t.criado_por === actor.id ||
    t.atribuido_a === actor.id ||
    (Array.isArray(tParticipantes) && tParticipantes.includes(actor.id)) ||
    isPrivileged(actor);
  if (!canToggle) return { error: "Sem permissão" };

  const novoStatus = t.status === "concluida" ? "aberta" : "concluida";
  const isClosing = novoStatus === "concluida";

  // Designer fechando sem ter informado quantas artes → pede prompt
  if (isClosing && actor.role === "designer" && artesEntregues === undefined) {
    return { requiresArtesPrompt: true };
  }

  // Valida artesEntregues quando enviado (apenas designer + fechando)
  let artesValor: number | null = null;
  if (isClosing && actor.role === "designer" && artesEntregues !== undefined) {
    const parsed = artesEntreguesSchema.safeParse(artesEntregues);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    artesValor = parsed.data;
  }

  const completed_at = isClosing ? new Date().toISOString() : null;

  // Payload: só inclui artes_entregues quando designer está fechando.
  // Reabrir ou outros roles → não toca no campo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tAny = t as any;
  type TaskPatch = { status: "aberta" | "concluida"; completed_at: string | null; artes_entregues?: number | null };
  const updatePayload: TaskPatch = { status: novoStatus as "aberta" | "concluida", completed_at };
  if (isClosing && actor.role === "designer") {
    updatePayload.artes_entregues = artesValor;
  }

  const { error } = await supabase
    .from("tasks")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updatePayload as any)
    .eq("id", taskId);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "tasks",
    entidade_id: taskId,
    acao: novoStatus === "concluida" ? "complete" : "reopen",
    dados_antes: {
      status: t.status,
      completed_at: t.completed_at,
      artes_entregues: tAny.artes_entregues ?? null,
    } as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  if (novoStatus === "concluida") {
    await dispatchNotification({
      evento_tipo: "task_completed",
      titulo: "Tarefa concluída",
      mensagem: `${actor.nome} concluiu: "${t.titulo}"`,
      link: `/tarefas/${taskId}`,
      user_ids_extras: [t.criado_por],
      source_user_id: actor.id,
    });
  }

  revalidatePath("/tarefas");
  revalidateTag("tasks", "default");
  revalidateTag("dashboard", "default");
  revalidatePath(`/tarefas/${taskId}`);
  if (t.client_id) revalidatePath(`/clientes/${t.client_id}/tarefas`);
  revalidateTag("dashboard", "default");
  revalidateTag("tasks", "default");
  return { success: novoStatus === "concluida" ? "Tarefa concluída" : "Tarefa reaberta" };
}

/**
 * Atualiza apenas o status de uma tarefa (usado por drag-drop no Quadro Kanban).
 * Para toggle simples aberta↔concluida via quick-complete, usa toggleTaskCompletionAction.
 *
 * Permissão: criador, atribuído, ou sócio/adm.
 * Side effects: atualiza completed_at, audit log, dispatch de notificação quando vai pra concluida.
 */
export async function moveTaskStatusAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = moveStatusSchema.safeParse({
    id: fd(formData, "id"),
    to_status: fd(formData, "to_status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: before } = await supabase.from("tasks").select("*").eq("id", parsed.data.id).single();
  if (!before) return { error: "Tarefa não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beforeParticipantes = (before as any).participantes_ids as string[] | null | undefined;
  const canMove =
    before.criado_por === actor.id ||
    before.atribuido_a === actor.id ||
    (Array.isArray(beforeParticipantes) && beforeParticipantes.includes(actor.id)) ||
    isPrivileged(actor);
  if (!canMove) return { error: "Sem permissão" };

  if (before.status === parsed.data.to_status) {
    return { success: true as const };
  }

  // Lógica do completed_at idêntica ao updateTaskAction
  const completed_at =
    parsed.data.to_status === "concluida" && before.status !== "concluida"
      ? new Date().toISOString()
      : parsed.data.to_status !== "concluida"
        ? null
        : before.completed_at;

  type Patch = { status: "aberta" | "em_andamento" | "concluida"; completed_at: string | null };
  const patch: Patch = { status: parsed.data.to_status, completed_at };

  const { error } = await supabase.from("tasks").update(patch).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "tasks",
    entidade_id: parsed.data.id,
    acao: parsed.data.to_status === "concluida" ? "complete" : before.status === "concluida" ? "reopen" : "update",
    dados_antes: { status: before.status, completed_at: before.completed_at },
    dados_depois: patch as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  if (parsed.data.to_status === "concluida" && before.status !== "concluida") {
    await dispatchNotification({
      evento_tipo: "task_completed",
      titulo: "Tarefa concluída",
      mensagem: `${actor.nome} concluiu: "${before.titulo}"`,
      link: `/tarefas/${parsed.data.id}`,
      user_ids_extras: [before.criado_por],
      source_user_id: actor.id,
    });
  }

  revalidatePath("/tarefas");
  revalidateTag("tasks", "default");
  revalidateTag("dashboard", "default");
  revalidatePath(`/tarefas/${parsed.data.id}`);
  if (before.client_id) revalidatePath(`/clientes/${before.client_id}/tarefas`);
  revalidateTag("dashboard", "default");
  revalidateTag("tasks", "default");
  return { success: true as const };
}

export async function deleteTaskAction(taskId: string) {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { data: t } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (!t) return { error: "Tarefa não encontrada" };

  const canDelete = t.criado_por === actor.id || isPrivileged(actor);
  if (!canDelete) return { error: "Sem permissão" };

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "tasks",
    entidade_id: taskId,
    acao: "delete",
    dados_antes: t as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/tarefas");
  revalidateTag("tasks", "default");
  revalidateTag("dashboard", "default");
  if (t.client_id) revalidatePath(`/clientes/${t.client_id}/tarefas`);
  revalidateTag("dashboard", "default");
  revalidateTag("tasks", "default");
  redirect("/tarefas");
}

// ============================================================================
// Fluxo de aprovação (vídeo/arte): submit → approve / request adjustments
// ============================================================================

type ApprovalResult = { error?: string; success?: boolean };

async function loadTaskForApproval(taskId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (error || !data) return { error: "Tarefa não encontrada" as const, supabase };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = data as any;
  if (t.tipo !== "video" && t.tipo !== "arte") {
    return { error: "Esta tarefa não tem fluxo de aprovação" as const, supabase };
  }
  return { task: t, supabase };
}

async function insertRevisao(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  args: { taskId: string; autorId: string; tipo: "envio" | "aprovacao" | "ajustes"; observacoes?: string | null },
) {
  await supabase.from("task_revisoes").insert({
    task_id: args.taskId,
    autor_id: args.autorId,
    tipo: args.tipo,
    observacoes: args.observacoes ?? null,
  });
}

/** Atribuído ou participante marca a tarefa como entregue para análise. */
export async function submitForApprovalAction(taskId: string): Promise<ApprovalResult> {
  const actor = await requireAuth();
  const loaded = await loadTaskForApproval(taskId);
  if ("error" in loaded && loaded.error) return { error: loaded.error };
  const { task, supabase } = loaded as { task: { atribuido_a: string; participantes_ids: string[] | null; status_aprovacao: string; criado_por: string; titulo: string; client_id: string | null }; supabase: Awaited<ReturnType<typeof createClient>> };

  const isExecutor =
    task.atribuido_a === actor.id ||
    (Array.isArray(task.participantes_ids) && task.participantes_ids.includes(actor.id));
  if (!isExecutor) return { error: "Apenas o atribuído ou participantes podem enviar para análise" };

  if (task.status_aprovacao !== "pendente_envio" && task.status_aprovacao !== "ajustes_solicitados") {
    return { error: "Tarefa não está num estado válido para envio" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("tasks")
    .update({ status_aprovacao: "em_analise" })
    .eq("id", taskId);
  if (error) return { error: error.message };

  await insertRevisao(supabase, { taskId, autorId: actor.id, tipo: "envio" });

  await dispatchNotification({
    evento_tipo: "task_assigned",
    titulo: "Tarefa enviada para análise",
    mensagem: `${actor.nome} enviou para análise: "${task.titulo}"`,
    link: `/tarefas/${taskId}`,
    user_ids_extras: [task.criado_por],
    source_user_id: actor.id,
  });

  revalidatePath(`/tarefas/${taskId}`);
  revalidatePath("/tarefas");
  revalidateTag("tasks", "default");
  if (task.client_id) revalidatePath(`/clientes/${task.client_id}/tarefas`);
  return { success: true };
}

/** Assessor (criador) ou adm/socio aprova. */
export async function approveTaskAction(taskId: string): Promise<ApprovalResult> {
  const actor = await requireAuth();
  const loaded = await loadTaskForApproval(taskId);
  if ("error" in loaded && loaded.error) return { error: loaded.error };
  const { task, supabase } = loaded as { task: { criado_por: string; atribuido_a: string; participantes_ids: string[] | null; status_aprovacao: string; titulo: string; client_id: string | null }; supabase: Awaited<ReturnType<typeof createClient>> };

  const canApprove = task.criado_por === actor.id || isPrivileged(actor);
  if (!canApprove) return { error: "Apenas o criador (assessor) ou adm/sócio pode aprovar" };

  if (task.status_aprovacao !== "em_analise") {
    return { error: "Tarefa não está em análise" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("tasks")
    .update({ status_aprovacao: "aprovado" })
    .eq("id", taskId);
  if (error) return { error: error.message };

  await insertRevisao(supabase, { taskId, autorId: actor.id, tipo: "aprovacao" });

  const recipients = [task.atribuido_a, ...(task.participantes_ids ?? [])].filter(
    (id): id is string => !!id && id !== actor.id,
  );
  if (recipients.length > 0) {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "Tarefa aprovada",
      mensagem: `${actor.nome} aprovou: "${task.titulo}"`,
      link: `/tarefas/${taskId}`,
      user_ids_extras: recipients,
      source_user_id: actor.id,
    });
  }

  revalidatePath(`/tarefas/${taskId}`);
  revalidatePath("/tarefas");
  revalidateTag("tasks", "default");
  if (task.client_id) revalidatePath(`/clientes/${task.client_id}/tarefas`);
  return { success: true };
}

/** Assessor (criador) ou adm/socio pede ajustes (texto obrigatório). */
export async function requestAdjustmentsAction(formData: FormData): Promise<ApprovalResult> {
  const actor = await requireAuth();

  const parsed = requestAdjustmentsSchema.safeParse({
    id: fd(formData, "id"),
    observacoes: fd(formData, "observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const loaded = await loadTaskForApproval(parsed.data.id);
  if ("error" in loaded && loaded.error) return { error: loaded.error };
  const { task, supabase } = loaded as { task: { criado_por: string; atribuido_a: string; participantes_ids: string[] | null; status_aprovacao: string; titulo: string; client_id: string | null }; supabase: Awaited<ReturnType<typeof createClient>> };

  const canRequest = task.criado_por === actor.id || isPrivileged(actor);
  if (!canRequest) return { error: "Apenas o criador (assessor) ou adm/sócio pode pedir ajustes" };

  if (task.status_aprovacao !== "em_analise") {
    return { error: "Tarefa não está em análise" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("tasks")
    .update({ status_aprovacao: "ajustes_solicitados" })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await insertRevisao(supabase, {
    taskId: parsed.data.id,
    autorId: actor.id,
    tipo: "ajustes",
    observacoes: parsed.data.observacoes,
  });

  const recipients = [task.atribuido_a, ...(task.participantes_ids ?? [])].filter(
    (id): id is string => !!id && id !== actor.id,
  );
  if (recipients.length > 0) {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "Ajustes solicitados",
      mensagem: `${actor.nome} pediu ajustes: "${task.titulo}"`,
      link: `/tarefas/${parsed.data.id}`,
      user_ids_extras: recipients,
      source_user_id: actor.id,
    });
  }

  revalidatePath(`/tarefas/${parsed.data.id}`);
  revalidatePath("/tarefas");
  revalidateTag("tasks", "default");
  if (task.client_id) revalidatePath(`/clientes/${task.client_id}/tarefas`);
  return { success: true };
}
