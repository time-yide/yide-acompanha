import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { urlPlaylist, statusVideo, bunnyConfigurado } from "@/lib/bunny/client";
import type { Comentario } from "./queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface VersaoTarefa { id: string; numero: number; bunny_video_id: string; pronto: boolean; playlistUrl: string; comentarios: Comentario[] }
export interface ReviewDaTarefa {
  reviewId: string;
  status: string;
  versoes: VersaoTarefa[];
  /** % que ESTE usuário assistiu da versão ATUAL (última). */
  assistidoPctVersaoAtual: number;
}

/** Review ligado a uma tarefa (ou null). Inclui o quanto o usuário assistiu da versão atual. */
export async function getReviewDaTarefa(taskId: string, userId: string): Promise<ReviewDaTarefa | null> {
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb
    .from("review_video")
    .select("id, status")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!rv) return null;

  const { data: versoes } = await sb
    .from("review_versao")
    .select("id, numero, bunny_video_id, pronto")
    .eq("review_video_id", rv.id)
    .order("numero", { ascending: true });
  const vs = (versoes ?? []) as Array<{ id: string; numero: number; bunny_video_id: string; pronto: boolean }>;

  // Self-heal do status (igual carregarReview).
  if (bunnyConfigurado()) {
    await Promise.all(vs.filter((v) => !v.pronto).map(async (v) => {
      try { const st = await statusVideo(v.bunny_video_id); if (st.pronto) { v.pronto = true; await sb.from("review_versao").update({ pronto: true, duracao_seg: st.duracaoSeg }).eq("id", v.id); } } catch {}
    }));
  }

  const versaoIds = vs.map((v) => v.id);
  const { data: coments } = versaoIds.length
    ? await sb.from("review_comentario").select("id, versao_id, autor_tipo, autor_nome, tempo_seg, corpo, resolvido, created_at").in("versao_id", versaoIds).order("tempo_seg", { ascending: true })
    : { data: [] };
  const porVersao = new Map<string, Comentario[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (coments ?? []) as any[]) { const arr = porVersao.get(c.versao_id) ?? []; arr.push(c); porVersao.set(c.versao_id, arr); }

  const atual = vs[vs.length - 1];
  let assistidoPctVersaoAtual = 0;
  if (atual) {
    const { data: a } = await sb.from("review_assistido").select("pct_max").eq("user_id", userId).eq("versao_id", atual.id).maybeSingle();
    assistidoPctVersaoAtual = (a?.pct_max as number | undefined) ?? 0;
  }

  return {
    reviewId: rv.id,
    status: rv.status,
    versoes: vs.map((v) => ({ id: v.id, numero: v.numero, bunny_video_id: v.bunny_video_id, pronto: v.pronto, playlistUrl: urlPlaylist(v.bunny_video_id), comentarios: porVersao.get(v.id) ?? [] })),
    assistidoPctVersaoAtual,
  };
}
