"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { criarVideo, assinaturaUpload, statusVideo, type UploadTus } from "@/lib/bunny/client";
import { podeTransicionar, type ReviewStatus } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res<T> = T | { error: string };

function pode(role: string) { return canAccess(role, "manage:review"); }

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

export async function comentarAction(reviewId: string, versaoId: string, tempoSeg: number, corpo: string): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  if (!corpo.trim()) return { error: "Escreva um comentário" };
  const sb = createServiceRoleClient() as SB;
  await sb.from("review_comentario").insert({
    versao_id: versaoId, autor_tipo: "time", autor_id: user.id, autor_nome: user.nome,
    tempo_seg: Math.max(0, Math.round(tempoSeg)), corpo: corpo.trim(),
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

/** Pede alteração: manda o review pra "ajustes" — o editor vê e entra pra ler os comentários. */
export async function pedirAlteracaoAction(reviewId: string): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb.from("review_video").select("status").eq("id", reviewId).maybeSingle();
  if (!rv) return { error: "Review não encontrado" };
  if (!podeTransicionar(rv.status as ReviewStatus, "ajustes")) return { error: "Não dá pra pedir alteração agora" };
  await sb.from("review_video").update({ status: "ajustes", updated_at: new Date().toISOString() }).eq("id", reviewId);
  revalidatePath(`/audiovisual/review/${reviewId}`);
  revalidatePath("/audiovisual/review");
  return { ok: true };
}

/** Aprova UM vídeo (review) — status vira "aprovado". */
export async function aprovarVideoAction(reviewId: string): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb.from("review_video").select("status").eq("id", reviewId).maybeSingle();
  if (!rv) return { error: "Vídeo não encontrado" };
  if (!podeTransicionar(rv.status as ReviewStatus, "aprovado")) return { error: "Não dá pra aprovar agora" };
  await sb.from("review_video").update({ status: "aprovado", updated_at: new Date().toISOString() }).eq("id", reviewId);
  revalidatePath(`/audiovisual/review/${reviewId}`);
  return { ok: true };
}

function msgBunny(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m === "BUNNY_NAO_CONFIGURADO") return "Player de vídeo (Bunny) não configurado. Veja docs/frame-interno-bunny-setup.md.";
  return "Falha ao falar com o Bunny Stream.";
}
