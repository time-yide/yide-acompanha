import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { urlPlaylist, urlThumbnail, statusVideo, bunnyConfigurado } from "@/lib/bunny/client";
import type { ReviewStatus, AutorTipo } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface ReviewListItem { id: string; titulo: string; status: ReviewStatus; clienteNome: string | null; created_at: string }
export interface Comentario { id: string; autor_tipo: AutorTipo; autor_nome: string; tempo_seg: number; corpo: string; resolvido: boolean; created_at: string }
export interface Versao { id: string; numero: number; bunny_video_id: string; pronto: boolean; playlistUrl: string; thumbUrl: string; comentarios: Comentario[] }
export interface ReviewFull { id: string; titulo: string; status: ReviewStatus; clienteNome: string | null; taskId: string | null; assistidoPctVersaoAtual: number; versoes: Versao[] }

export async function listarReviews(): Promise<ReviewListItem[]> {
  const sb = createServiceRoleClient() as SB;
  const { data } = await sb
    .from("review_video")
    .select("id, titulo, status, created_at, clients(nome)")
    .order("created_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id, titulo: r.titulo, status: r.status, created_at: r.created_at,
    clienteNome: r.clients?.nome ?? null,
  }));
}

export async function carregarReview(id: string, userId: string): Promise<ReviewFull | null> {
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb
    .from("review_video")
    .select("id, titulo, status, task_id, clients(nome)")
    .eq("id", id)
    .maybeSingle();
  if (!rv) return null;
  const { data: versoes } = await sb
    .from("review_versao")
    .select("id, numero, bunny_video_id, pronto")
    .eq("review_video_id", id)
    .order("numero", { ascending: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vs = (versoes ?? []) as any[];

  // Self-heal: versões ainda "processando" — checa no Bunny e atualiza se já ficaram prontas.
  // (Cobre o caso do usuário recarregar antes do polling terminar.) Best-effort.
  if (bunnyConfigurado()) {
    await Promise.all(
      vs.filter((v) => !v.pronto).map(async (v) => {
        try {
          const st = await statusVideo(v.bunny_video_id);
          if (st.pronto) {
            v.pronto = true;
            await sb.from("review_versao").update({ pronto: true, duracao_seg: st.duracaoSeg }).eq("id", v.id);
          }
        } catch {
          // ignora — segue como processando
        }
      }),
    );
  }

  const versaoIds = vs.map((v) => v.id);
  const { data: coments } = versaoIds.length
    ? await sb.from("review_comentario").select("id, versao_id, autor_tipo, autor_nome, tempo_seg, corpo, resolvido, created_at").in("versao_id", versaoIds).order("tempo_seg", { ascending: true })
    : { data: [] };
  const porVersao = new Map<string, Comentario[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (coments ?? []) as any[]) {
    const arr = porVersao.get(c.versao_id) ?? [];
    arr.push(c);
    porVersao.set(c.versao_id, arr);
  }

  // Assistido do usuário na versão atual (última).
  let assistidoPctVersaoAtual = 0;
  const versaoAtual = vs[vs.length - 1];
  if (versaoAtual) {
    const { data: a } = await sb
      .from("review_assistido")
      .select("pct_max")
      .eq("user_id", userId)
      .eq("versao_id", versaoAtual.id)
      .maybeSingle();
    assistidoPctVersaoAtual = (a?.pct_max as number | undefined) ?? 0;
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    id: rv.id, titulo: rv.titulo, status: rv.status, clienteNome: (rv as any).clients?.nome ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    taskId: (rv as any).task_id ?? null, assistidoPctVersaoAtual,
    versoes: vs.map((v) => ({
      id: v.id, numero: v.numero, bunny_video_id: v.bunny_video_id, pronto: v.pronto,
      playlistUrl: urlPlaylist(v.bunny_video_id), thumbUrl: urlThumbnail(v.bunny_video_id),
      comentarios: porVersao.get(v.id) ?? [],
    })),
  };
}

export interface VideoDoBloco {
  reviewId: string;
  titulo: string;
  status: ReviewStatus;
  thumbUrl: string;
  versaoAtualId: string | null;
  prontoAtual: boolean;
  assistidoPct: number;
}

/** Todos os vídeos (review_video) de uma tarefa/bloco, com o essencial pra listar. */
export async function getReviewsDaTarefa(taskId: string, userId: string): Promise<VideoDoBloco[]> {
  const sb = createServiceRoleClient() as SB;
  const { data: rvs } = await sb
    .from("review_video")
    .select("id, titulo, status")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  const lista = (rvs ?? []) as Array<{ id: string; titulo: string; status: ReviewStatus }>;
  const out: VideoDoBloco[] = [];
  for (const rv of lista) {
    const { data: versoes } = await sb
      .from("review_versao")
      .select("id, bunny_video_id, pronto")
      .eq("review_video_id", rv.id)
      .order("numero", { ascending: false })
      .limit(1);
    const atual = (versoes ?? [])[0] as { id: string; bunny_video_id: string; pronto: boolean } | undefined;
    let assistidoPct = 0;
    if (atual) {
      const { data: a } = await sb.from("review_assistido").select("pct_max").eq("user_id", userId).eq("versao_id", atual.id).maybeSingle();
      assistidoPct = (a?.pct_max as number | undefined) ?? 0;
    }
    out.push({
      reviewId: rv.id, titulo: rv.titulo, status: rv.status,
      thumbUrl: atual ? urlThumbnail(atual.bunny_video_id) : "",
      versaoAtualId: atual?.id ?? null, prontoAtual: atual?.pronto ?? false, assistidoPct,
    });
  }
  return out;
}
