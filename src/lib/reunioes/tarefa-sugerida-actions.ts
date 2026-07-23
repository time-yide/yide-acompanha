"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { canRecordMeeting, podeVerReuniao } from "./permissions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res<T> = T | { error: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function carregarCtx(sb: SB, id: string): Promise<{ et: any; mt: any } | null> {
  const { data: et } = await sb.from("meeting_extracted_tasks").select("id, meeting_id, titulo_sugerido, descricao_sugerida, estado, task_id").eq("id", id).maybeSingle();
  if (!et) return null;
  const { data: mt } = await sb.from("meetings").select("id, owner_user_id, client_id").eq("id", et.meeting_id).maybeSingle();
  if (!mt) return null;
  return { et, mt };
}

/** Aceita a sugestão da IA: cria uma tarefa real e vincula. */
export async function aceitarTarefaAction(id: string): Promise<Res<{ taskId: string }>> {
  const user = await requireAuth();
  const sb = createServiceRoleClient() as SB;
  const ctx = await carregarCtx(sb, id);
  if (!ctx) return { error: "Sugestão não encontrada" };
  const { et, mt } = ctx;
  if (!canRecordMeeting(user.role) || !podeVerReuniao(user, { owner_user_id: mt.owner_user_id })) return { error: "Sem permissão" };
  if (et.estado === "aceita" && et.task_id) return { error: "Essa tarefa já foi criada" };

  const { data: created, error } = await sb.from("tasks").insert({
    titulo: et.titulo_sugerido,
    descricao: et.descricao_sugerida ?? null,
    prioridade: "media",
    tipo: "geral",
    formatos: [],
    status_aprovacao: null,
    atribuido_a: mt.owner_user_id,
    client_id: mt.client_id ?? null,
    criado_por: user.id,
    participantes_ids: [],
    links: [],
    attachment_urls: [],
  }).select("id").single();
  if (error || !created) return { error: error?.message ?? "Falha ao criar tarefa" };

  await sb.from("meeting_extracted_tasks").update({ estado: "aceita", task_id: created.id }).eq("id", id);
  revalidatePath(`/reunioes/${mt.id}`);
  return { taskId: created.id };
}

/** Descarta a sugestão. */
export async function descartarTarefaAction(id: string): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  const sb = createServiceRoleClient() as SB;
  const ctx = await carregarCtx(sb, id);
  if (!ctx) return { error: "Sugestão não encontrada" };
  const { mt } = ctx;
  if (!canRecordMeeting(user.role) || !podeVerReuniao(user, { owner_user_id: mt.owner_user_id })) return { error: "Sem permissão" };
  await sb.from("meeting_extracted_tasks").update({ estado: "descartada" }).eq("id", id);
  revalidatePath(`/reunioes/${mt.id}`);
  return { ok: true };
}
