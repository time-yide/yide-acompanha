"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess, canManageAnyTask } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { criarVideo, assinaturaUpload, statusVideo, type UploadTus } from "@/lib/bunny/client";
import { podeTransicionar, type ReviewStatus } from "./schema";
import { destravado } from "./gate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res<T> = T | { error: string };

function pode(role: string) { return canAccess(role, "manage:review"); }
/** Quem revisa/aprova: gestão de tarefa (assessor/coord/adm/sócio/audiovisual) OU quem gerencia review. */
function podeRevisar(role: string) { return canManageAnyTask({ role }) || canAccess(role, "manage:review"); }

/** Cria o review + o primeiro vídeo no Bunny; devolve os dados de upload TUS. */
export async function criarReviewAction(titulo: string, clienteId: string | null): Promise<Res<{ reviewId: string; upload: UploadTus }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  if (!titulo.trim()) return { error: "Dê um título ao review" };
  const sb = createServiceRoleClient() as SB;
  const { data: org } = await sb.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  let guid: string;
  try { guid = await criarVideo(titulo.trim()); }
  catch (e) { return { error: msgBunny(e) }; }

  const { data: rv, error } = await sb
    .from("review_video")
    .insert({ organization_id: org.id, cliente_id: clienteId, titulo: titulo.trim(), status: "revisao_interna", criado_por: user.id })
    .select("id").single();
  if (error || !rv) return { error: "Falha ao criar review" };

  await sb.from("review_versao").insert({ review_video_id: rv.id, numero: 1, bunny_video_id: guid, criado_por: user.id });
  return { reviewId: rv.id, upload: assinaturaUpload(guid) };
}

/** Sobe nova versão: cria vídeo no Bunny e registra a versão. Devolve upload TUS. */
export async function novaVersaoAction(reviewId: string, titulo: string): Promise<Res<UploadTus>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: ultimas } = await sb.from("review_versao").select("numero").eq("review_video_id", reviewId).order("numero", { ascending: false }).limit(1);
  const prox = ((ultimas?.[0]?.numero as number | undefined) ?? 0) + 1;
  let guid: string;
  try { guid = await criarVideo(`${titulo} v${prox}`); }
  catch (e) { return { error: msgBunny(e) }; }
  await sb.from("review_versao").insert({ review_video_id: reviewId, numero: prox, bunny_video_id: guid, criado_por: user.id });
  // Se estava em "ajustes", subir nova versão devolve pra revisão interna.
  await sb.from("review_video").update({ status: "revisao_interna", updated_at: new Date().toISOString() }).eq("id", reviewId).eq("status", "ajustes");
  revalidatePath(`/audiovisual/review/${reviewId}`);
  return assinaturaUpload(guid);
}

/** Marca a versão como pronta (chamado após o Bunny terminar de processar). */
export async function confirmarProntoAction(reviewId: string, bunnyVideoId: string): Promise<Res<{ pronto: boolean }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  let st: { pronto: boolean; duracaoSeg: number };
  try { st = await statusVideo(bunnyVideoId); }
  catch (e) { return { error: msgBunny(e) }; }
  if (st.pronto) {
    const sb = createServiceRoleClient() as SB;
    await sb.from("review_versao").update({ pronto: true, duracao_seg: st.duracaoSeg }).eq("bunny_video_id", bunnyVideoId);
    revalidatePath(`/audiovisual/review/${reviewId}`);
  }
  return { pronto: st.pronto };
}

export async function comentarAction(
  reviewId: string,
  versaoId: string,
  tempoSeg: number,
  corpo: string,
  posX?: number | null,
  posY?: number | null,
): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  if (!corpo.trim()) return { error: "Escreva um comentário" };
  // Coordenadas do alfinete/balão (0..1). Só grava se as duas vierem válidas.
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const temPino = typeof posX === "number" && typeof posY === "number" && isFinite(posX) && isFinite(posY);
  const sb = createServiceRoleClient() as SB;
  await sb.from("review_comentario").insert({
    versao_id: versaoId, autor_tipo: "time", autor_id: user.id, autor_nome: user.nome,
    tempo_seg: Math.max(0, Math.round(tempoSeg)), corpo: corpo.trim(),
    pos_x: temPino ? clamp01(posX as number) : null,
    pos_y: temPino ? clamp01(posY as number) : null,
  });
  revalidatePath(`/audiovisual/review/${reviewId}`);
  return { ok: true };
}

export async function resolverComentarioAction(reviewId: string, comentarioId: string, resolvido: boolean): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  await sb.from("review_comentario").update({ resolvido }).eq("id", comentarioId);
  revalidatePath(`/audiovisual/review/${reviewId}`);
  return { ok: true };
}

export async function aprovarInternoAction(reviewId: string): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb.from("review_video").select("status").eq("id", reviewId).maybeSingle();
  if (!rv) return { error: "Review não encontrado" };
  if (!podeTransicionar(rv.status as ReviewStatus, "revisao_cliente")) return { error: "Esse review não está em revisão interna" };
  await sb.from("review_video").update({ status: "revisao_cliente", updated_at: new Date().toISOString() }).eq("id", reviewId);
  revalidatePath(`/audiovisual/review/${reviewId}`);
  revalidatePath("/audiovisual/review");
  return { ok: true };
}

/**
 * Espelha a decisão do Frame no Kanban da tarefa vinculada ao review:
 * - "alteracao": pedir alteração joga o card pra coluna "Alteração" (volta pro editor);
 * - "em_aprovacao": aprovar (revisão interna) manda pra "Aprovação" (aprovação do cliente).
 * Sem isso o card ficava preso em "Concluído Operacional". Roda com service-role
 * (ignora RLS) e invalida a tag "tasks" pra o board atualizar. Best-effort: se a
 * tarefa não existe/não está vinculada, só ignora — o status do review já mudou.
 */
async function moverTarefaDoReview(
  sb: SB,
  reviewId: string,
  destino: "alteracao" | "em_aprovacao",
  actor: { id: string; nome: string },
): Promise<void> {
  const { data: rv } = await sb.from("review_video").select("task_id").eq("id", reviewId).maybeSingle();
  const taskId = rv?.task_id as string | null | undefined;
  if (!taskId) return;
  const { data: task } = await sb
    .from("tasks")
    .select("id, titulo, atribuido_a, participantes_ids, criado_por, client_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return;

  const status_aprovacao = destino === "alteracao" ? "ajustes_solicitados" : "em_analise";
  await sb.from("tasks").update({ status: destino, status_aprovacao }).eq("id", taskId);

  // Timeline de revisões da tarefa (mesma tabela do fluxo de aprovação normal).
  await sb.from("task_revisoes").insert({
    task_id: taskId,
    autor_id: actor.id,
    tipo: destino === "alteracao" ? "ajustes" : "envio",
    observacoes: destino === "alteracao" ? "Alterações pedidas no Frame — ver comentários no vídeo." : null,
  });

  const participantes = (task.participantes_ids ?? []) as string[];
  if (destino === "alteracao") {
    // Avisa o responsável (editor/videomaker) que precisa ajustar.
    const destinatarios = [task.atribuido_a, ...participantes].filter(
      (id: string | null): id is string => !!id && id !== actor.id,
    );
    if (destinatarios.length > 0) {
      await dispatchNotification({
        evento_tipo: "task_alteracao_solicitada",
        titulo: `Ajustes solicitados: ${task.titulo}`,
        mensagem: "Foram pedidas alterações no Frame — veja os comentários no vídeo.",
        link: `/tarefas/${taskId}`,
        user_ids_extras: destinatarios,
        source_user_id: actor.id,
      });
    }
  } else {
    // Avisa o criador (assessor) que o vídeo passou na revisão interna e foi pra aprovação.
    if (task.criado_por && task.criado_por !== actor.id) {
      await dispatchNotification({
        evento_tipo: "task_assigned",
        titulo: "Vídeo aprovado internamente",
        mensagem: `${actor.nome} aprovou no Frame e enviou pra aprovação: "${task.titulo}"`,
        link: `/tarefas/${taskId}`,
        user_ids_extras: [task.criado_por],
        source_user_id: actor.id,
      });
    }
  }

  revalidateTag("tasks", "default");
  revalidatePath(`/tarefas/${taskId}`);
  revalidatePath("/tarefas");
  if (task.client_id) revalidatePath(`/clientes/${task.client_id}/tarefas`);
}

/** Pede alteração: manda o review pra "ajustes" — o editor vê e entra pra ler os comentários. */
export async function pedirAlteracaoAction(reviewId: string): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!podeRevisar(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb.from("review_video").select("status").eq("id", reviewId).maybeSingle();
  if (!rv) return { error: "Review não encontrado" };
  if (!podeTransicionar(rv.status as ReviewStatus, "ajustes")) return { error: "Não dá pra pedir alteração agora" };
  // Trava: só pede alteração depois de assistir a versão atual até o fim (server-side).
  const { data: ult } = await sb.from("review_versao").select("id").eq("review_video_id", reviewId).order("numero", { ascending: false }).limit(1).maybeSingle();
  if (ult) {
    const { data: a } = await sb.from("review_assistido").select("pct_max").eq("user_id", user.id).eq("versao_id", ult.id).maybeSingle();
    if (!destravado((a?.pct_max as number | undefined) ?? 0)) return { error: "Assista o vídeo até o fim antes de pedir alteração." };
  }
  await sb.from("review_video").update({ status: "ajustes", updated_at: new Date().toISOString() }).eq("id", reviewId);
  // Espelha no Kanban: a tarefa sai de "Concluído Operacional" pra "Alteração".
  await moverTarefaDoReview(sb, reviewId, "alteracao", user);
  revalidatePath(`/audiovisual/review/${reviewId}`);
  revalidatePath("/audiovisual/review");
  return { ok: true };
}

/** Aprova UM vídeo (review) — status vira "aprovado". */
export async function aprovarVideoAction(reviewId: string): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!podeRevisar(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb.from("review_video").select("status").eq("id", reviewId).maybeSingle();
  if (!rv) return { error: "Vídeo não encontrado" };
  if (!podeTransicionar(rv.status as ReviewStatus, "aprovado")) return { error: "Não dá pra aprovar agora" };
  // Trava: só aprova depois de assistir a versão atual até o fim (server-side).
  const { data: ult } = await sb.from("review_versao").select("id").eq("review_video_id", reviewId).order("numero", { ascending: false }).limit(1).maybeSingle();
  if (ult) {
    const { data: a } = await sb.from("review_assistido").select("pct_max").eq("user_id", user.id).eq("versao_id", ult.id).maybeSingle();
    if (!destravado((a?.pct_max as number | undefined) ?? 0)) return { error: "Assista o vídeo até o fim antes de aprovar." };
  }
  await sb.from("review_video").update({ status: "aprovado", updated_at: new Date().toISOString() }).eq("id", reviewId);
  // Espelha no Kanban: revisão interna aprovada → tarefa vai pra "Aprovação" (do cliente).
  await moverTarefaDoReview(sb, reviewId, "em_aprovacao", user);
  revalidatePath(`/audiovisual/review/${reviewId}`);
  return { ok: true };
}

function msgBunny(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m === "BUNNY_NAO_CONFIGURADO") return "Player de vídeo (Bunny) não configurado. Veja docs/frame-interno-bunny-setup.md.";
  return "Falha ao falar com o Bunny Stream.";
}
