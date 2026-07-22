"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { criarVideo, assinaturaUpload, urlDownloadMp4, type UploadTus } from "@/lib/bunny/client";
import { destravado } from "./gate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res<T> = T | { error: string };

function pode(role: string) { return canAccess(role, "manage:review"); }

/** Cria (ou reusa) o review da tarefa e prepara o upload da 1ª versão. */
export async function criarReviewDaTarefaAction(taskId: string): Promise<Res<{ reviewId: string; upload: UploadTus }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: task } = await sb.from("tasks").select("id, titulo, client_id").eq("id", taskId).maybeSingle();
  if (!task) return { error: "Tarefa não encontrada" };
  const { data: org } = await sb.from("organizations").select("id").limit(1).single();

  // reusa review existente da tarefa, se houver
  let reviewId: string;
  const { data: existente } = await sb.from("review_video").select("id").eq("task_id", taskId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existente) reviewId = existente.id;
  else {
    const { data: rv, error } = await sb.from("review_video").insert({ organization_id: org?.id, cliente_id: task.client_id, task_id: taskId, titulo: task.titulo, status: "revisao_interna", criado_por: user.id }).select("id").single();
    if (error || !rv) return { error: "Falha ao criar review" };
    reviewId = rv.id;
  }

  let guid: string;
  try { guid = await criarVideo(task.titulo); } catch { return { error: "Falha ao criar vídeo no Bunny (configuração?)" }; }
  const { data: ult } = await sb.from("review_versao").select("numero").eq("review_video_id", reviewId).order("numero", { ascending: false }).limit(1);
  const prox = ((ult?.[0]?.numero as number | undefined) ?? 0) + 1;
  await sb.from("review_versao").insert({ review_video_id: reviewId, numero: prox, bunny_video_id: guid, criado_por: user.id });
  // "Toca" a tarefa pra o TaskRealtimeWatcher atualizar a página do assessor
  // (nova versão → a trava de assistir rearma automaticamente).
  await sb.from("tasks").update({ updated_at: new Date().toISOString() }).eq("id", taskId);
  revalidatePath(`/tarefas/${taskId}`);
  return { reviewId, upload: assinaturaUpload(guid) };
}

export async function adicionarVideoAction(taskId: string, titulo: string): Promise<Res<{ reviewId: string; upload: UploadTus }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: task } = await sb.from("tasks").select("id, titulo, client_id").eq("id", taskId).maybeSingle();
  if (!task) return { error: "Tarefa não encontrada" };
  const { data: org } = await sb.from("organizations").select("id").limit(1).single();
  const nome = titulo.trim() || task.titulo;
  const { data: rv, error } = await sb.from("review_video").insert({ organization_id: org?.id, cliente_id: task.client_id, task_id: taskId, titulo: nome, status: "revisao_interna", criado_por: user.id }).select("id").single();
  if (error || !rv) return { error: "Falha ao criar o vídeo" };
  let guid: string;
  try { guid = await criarVideo(nome); } catch { return { error: "Falha ao criar vídeo no Bunny (configuração?)" }; }
  await sb.from("review_versao").insert({ review_video_id: rv.id, numero: 1, bunny_video_id: guid, criado_por: user.id });
  revalidatePath(`/tarefas/${taskId}`);
  return { reviewId: rv.id, upload: assinaturaUpload(guid) };
}

/** Registra o progresso assistido (guarda o máximo). */
export async function registrarAssistidoAction(versaoId: string, pct: number): Promise<{ ok: true } | { error: string }> {
  const user = await requireAuth();
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const sb = createServiceRoleClient() as SB;
  const { data: atual } = await sb.from("review_assistido").select("pct_max").eq("user_id", user.id).eq("versao_id", versaoId).maybeSingle();
  const novo = Math.max(p, (atual?.pct_max as number | undefined) ?? 0);
  await sb.from("review_assistido").upsert({ user_id: user.id, versao_id: versaoId, pct_max: novo, updated_at: new Date().toISOString() }, { onConflict: "user_id,versao_id" });
  return { ok: true };
}

/** Link de download do MP4 — só libera se assistiu >= mínimo. */
export async function linkDownloadAction(versaoId: string): Promise<Res<{ url: string }>> {
  const user = await requireAuth();
  const sb = createServiceRoleClient() as SB;
  const { data: a } = await sb.from("review_assistido").select("pct_max").eq("user_id", user.id).eq("versao_id", versaoId).maybeSingle();
  if (!destravado((a?.pct_max as number | undefined) ?? 0)) return { error: "Assista o vídeo até o fim pra liberar o download." };
  const { data: v } = await sb.from("review_versao").select("bunny_video_id").eq("id", versaoId).maybeSingle();
  if (!v) return { error: "Versão não encontrada" };
  const url = await urlDownloadMp4(v.bunny_video_id);
  if (!url) return { error: "Download indisponível — habilite o 'MP4 fallback' na biblioteca do Bunny." };
  return { url };
}
