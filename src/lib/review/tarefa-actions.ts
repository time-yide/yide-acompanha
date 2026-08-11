"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { criarVideo, assinaturaUpload, urlDownloadMp4, deletarVideo, bunnyConfigurado, type UploadTus } from "@/lib/bunny/client";
import { carregarReview, type ReviewFull } from "@/lib/review/queries";
import { podeVerReview, podeGerenciarReview, podeAprovarReview } from "@/lib/review/permissions";
import { destravado } from "./gate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res<T> = T | { error: string };

function pode(role: string) { return canAccess(role, "manage:review"); }

/**
 * Traduz a falha do `criarVideo` (Bunny) numa mensagem que já diz O QUE fazer.
 * Antes engolíamos tudo em "configuração?" — agora o status do Bunny vira causa:
 * 401 chave errada, 402/403 cobrança/bloqueio, 404 library ID errado, 429 limite.
 */
function motivoBunny(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "BUNNY_NAO_CONFIGURADO") return "Frame não configurado: faltam as chaves do Bunny na Vercel.";
  const status = msg.startsWith("BUNNY_CRIAR_FALHOU:") ? Number(msg.split(":")[1]) : NaN;
  switch (status) {
    case 401: return "Frame recusou (401): a API key do Bunny está errada ou foi regerada.";
    case 402: return "Frame recusou (402): conta do Bunny com pendência de cobrança.";
    case 403: return "Frame recusou (403): conta/library do Bunny bloqueada.";
    case 404: return "Frame recusou (404): o BUNNY_STREAM_LIBRARY_ID não bate com a key.";
    case 429: return "Frame recusou (429): limite de uso do Bunny atingido. Tente daqui a pouco.";
    default: return `Frame recusou o upload${Number.isFinite(status) ? ` (erro ${status})` : ""}. Use "Enviar link do Drive".`;
  }
}

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
  try { guid = await criarVideo(task.titulo); } catch (e) { return { error: motivoBunny(e) }; }
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
  try { guid = await criarVideo(nome); } catch (e) { return { error: motivoBunny(e) }; }
  await sb.from("review_versao").insert({ review_video_id: rv.id, numero: 1, bunny_video_id: guid, criado_por: user.id });
  revalidatePath(`/tarefas/${taskId}`);
  return { reviewId: rv.id, upload: assinaturaUpload(guid) };
}

/** true se o Bunny está configurado — o modal usa pra decidir upload vs link do Drive. */
export async function bunnyDisponivelAction(): Promise<boolean> {
  await requireAuth();
  return bunnyConfigurado();
}

/**
 * Remove um vídeo (frame) da tarefa: apaga o vídeo no Bunny (best-effort) e o
 * registro em review_video — versões/comentários/assistido caem por CASCADE.
 * Usado pelo botão de apagar (limpar duplicados) e pelo rollback do modal de
 * entrega quando o upload falha (pra não deixar frame órfão/duplicado).
 */
export async function removerVideoAction(reviewId: string): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb.from("review_video").select("id, task_id").eq("id", reviewId).maybeSingle();
  if (!rv) return { error: "Vídeo não encontrado" };
  // Apaga os vídeos no Bunny antes de remover o registro (libera armazenamento).
  const { data: versoes } = await sb.from("review_versao").select("bunny_video_id").eq("review_video_id", reviewId);
  for (const v of (versoes ?? []) as Array<{ bunny_video_id: string }>) {
    await deletarVideo(v.bunny_video_id);
  }
  await sb.from("review_video").delete().eq("id", reviewId);
  if (rv.task_id) revalidatePath(`/tarefas/${rv.task_id}`);
  return { ok: true };
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

/**
 * Carrega um review + permissões pro modal na tarefa. Espelha a lógica da
 * tela /audiovisual/review/[id] via os helpers de permissão (fonte única).
 */
export async function carregarReviewAction(
  reviewId: string,
): Promise<Res<{ review: ReviewFull; podeGerenciar: boolean; podeAprovar: boolean }>> {
  const user = await requireAuth();
  if (!podeVerReview(user)) return { error: "Sem acesso ao review" };
  const review = await carregarReview(reviewId, user.id);
  if (!review) return { error: "Review não encontrado" };

  let taskCriadoPor: string | null = null;
  if (review.taskId) {
    const sb = createServiceRoleClient() as SB;
    const { data: t } = await sb.from("tasks").select("criado_por").eq("id", review.taskId).maybeSingle();
    taskCriadoPor = t?.criado_por ?? null;
  }

  return {
    review,
    podeGerenciar: podeGerenciarReview(user.role),
    podeAprovar: podeAprovarReview(user, taskCriadoPor),
  };
}
