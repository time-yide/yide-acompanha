"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { urlPlaylist, urlThumbnail } from "@/lib/bunny/client";
import { podeTransicionar, type ReviewStatus } from "./schema";
import { syncTarefaComReview } from "./task-sync";
import { tokenValido, soComentariosDoCliente, type ComentarioCliente, type ReviewCliente } from "./aprovacao-cliente-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res<T> = T | { error: string };

/** Carrega o review pra tela pública. null = token inválido ou inexistente. */
export async function getReviewPorToken(token: string): Promise<ReviewCliente | null> {
  if (!tokenValido(token)) return null;
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb
    .from("review_video")
    .select("id, titulo, status, cliente_id")
    .eq("aprovacao_token", token)
    .maybeSingle();
  if (!rv) return null;

  const { data: cliente } = rv.cliente_id
    ? await sb.from("clients").select("nome").eq("id", rv.cliente_id).maybeSingle()
    : { data: null };

  const { data: versao } = await sb
    .from("review_versao")
    .select("id, bunny_video_id, pronto")
    .eq("review_video_id", rv.id)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();

  let comentarios: ComentarioCliente[] = [];
  if (versao) {
    const { data: cs } = await sb
      .from("review_comentario")
      .select("id, autor_tipo, autor_nome, tempo_seg, corpo, pos_x, pos_y, created_at")
      .eq("versao_id", versao.id)
      .order("tempo_seg", { ascending: true });
    comentarios = soComentariosDoCliente((cs ?? []) as ComentarioCliente[]);
  }

  return {
    reviewId: rv.id,
    titulo: rv.titulo,
    status: rv.status as ReviewStatus,
    clienteNome: (cliente?.nome as string | undefined) ?? "Cliente",
    versaoId: versao?.id ?? null,
    playlistUrl: versao ? urlPlaylist(versao.bunny_video_id) : "",
    thumbUrl: versao ? urlThumbnail(versao.bunny_video_id) : "",
    pronto: !!versao?.pronto,
    comentarios,
  };
}

/** Busca review + versão atual a partir do token, garantindo estado revisao_cliente. */
async function reviewEmRevisaoCliente(sb: SB, token: string): Promise<{ id: string; status: ReviewStatus; versaoId: string | null; clienteNome: string } | { error: string }> {
  if (!tokenValido(token)) return { error: "Link inválido" };
  const { data: rv } = await sb.from("review_video").select("id, status, cliente_id").eq("aprovacao_token", token).maybeSingle();
  if (!rv) return { error: "Vídeo não encontrado" };
  const { data: versao } = await sb.from("review_versao").select("id").eq("review_video_id", rv.id).order("numero", { ascending: false }).limit(1).maybeSingle();
  const { data: cliente } = rv.cliente_id ? await sb.from("clients").select("nome").eq("id", rv.cliente_id).maybeSingle() : { data: null };
  return { id: rv.id, status: rv.status as ReviewStatus, versaoId: versao?.id ?? null, clienteNome: (cliente?.nome as string | undefined) ?? "Cliente" };
}

/** Cliente comenta marcando o tempo (e opcionalmente o ponto). Só em revisao_cliente. */
export async function comentarComoClienteAction(
  token: string, tempoSeg: number, corpo: string, posX?: number | null, posY?: number | null,
): Promise<Res<{ ok: true }>> {
  if (!corpo.trim()) return { error: "Escreva o comentário" };
  const sb = createServiceRoleClient() as SB;
  const rv = await reviewEmRevisaoCliente(sb, token);
  if ("error" in rv) return rv;
  if (rv.status !== "revisao_cliente") return { error: "Este vídeo não está aberto pra comentários agora." };
  if (!rv.versaoId) return { error: "Vídeo ainda processando." };
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const temPino = typeof posX === "number" && typeof posY === "number" && isFinite(posX) && isFinite(posY);
  await sb.from("review_comentario").insert({
    versao_id: rv.versaoId, autor_tipo: "cliente", autor_id: null, autor_nome: rv.clienteNome,
    tempo_seg: Math.max(0, Math.round(tempoSeg)), corpo: corpo.trim(),
    pos_x: temPino ? clamp01(posX as number) : null,
    pos_y: temPino ? clamp01(posY as number) : null,
  });
  revalidatePath(`/aprovacao-video/${token}`);
  return { ok: true };
}

/** Cliente aprova: review → aprovado, tarefa → aprovada, notifica a equipe. */
export async function aprovarComoClienteAction(token: string): Promise<Res<{ ok: true }>> {
  const sb = createServiceRoleClient() as SB;
  const rv = await reviewEmRevisaoCliente(sb, token);
  if ("error" in rv) return rv;
  if (!podeTransicionar(rv.status, "aprovado")) return { error: "Este vídeo não está aguardando sua aprovação." };
  await sb.from("review_video").update({ status: "aprovado", updated_at: new Date().toISOString() }).eq("id", rv.id);
  await syncTarefaComReview(sb, rv.id, "aprovada", null);
  revalidatePath(`/aprovacao-video/${token}`);
  return { ok: true };
}

/** Cliente pede alteração: review → ajustes, tarefa → alteração, notifica a equipe. */
export async function pedirAlteracaoComoClienteAction(token: string): Promise<Res<{ ok: true }>> {
  const sb = createServiceRoleClient() as SB;
  const rv = await reviewEmRevisaoCliente(sb, token);
  if ("error" in rv) return rv;
  if (!podeTransicionar(rv.status, "ajustes")) return { error: "Este vídeo não está aberto pra pedir alteração." };
  await sb.from("review_video").update({ status: "ajustes", updated_at: new Date().toISOString() }).eq("id", rv.id);
  await syncTarefaComReview(sb, rv.id, "alteracao", null);
  revalidatePath(`/aprovacao-video/${token}`);
  return { ok: true };
}
