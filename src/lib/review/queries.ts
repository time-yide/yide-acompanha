import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { urlPlaylist, urlThumbnail, statusVideo, bunnyConfigurado } from "@/lib/bunny/client";
import type { ReviewStatus, AutorTipo } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface ReviewListItem { id: string; titulo: string; status: ReviewStatus; clienteNome: string | null; taskId: string | null; created_at: string }
export interface Comentario { id: string; autor_tipo: AutorTipo; autor_nome: string; autor_avatar: string | null; tempo_seg: number; corpo: string; resolvido: boolean; created_at: string; pos_x: number | null; pos_y: number | null }
export interface Versao { id: string; numero: number; bunny_video_id: string; pronto: boolean; playlistUrl: string; thumbUrl: string; comentarios: Comentario[] }
export interface ReviewFull { id: string; titulo: string; status: ReviewStatus; clienteNome: string | null; taskId: string | null; assistidoPctVersaoAtual: number; aprovacaoToken: string | null; versoes: Versao[] }

export async function listarReviews(): Promise<ReviewListItem[]> {
  const sb = createServiceRoleClient() as SB;
  const { data } = await sb
    .from("review_video")
    .select("id, titulo, status, task_id, created_at, clients(nome)")
    .order("created_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id, titulo: r.titulo, status: r.status, created_at: r.created_at,
    taskId: r.task_id ?? null,
    clienteNome: r.clients?.nome ?? null,
  }));
}

export async function carregarReview(id: string, userId: string): Promise<ReviewFull | null> {
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb
    .from("review_video")
    .select("id, titulo, status, task_id, aprovacao_token, clients(nome)")
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
    ? await sb.from("review_comentario").select("id, versao_id, autor_tipo, autor_id, autor_nome, tempo_seg, corpo, resolvido, created_at, pos_x, pos_y").in("versao_id", versaoIds).order("tempo_seg", { ascending: true })
    : { data: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comentsRaw = (coments ?? []) as any[];
  // Foto do autor (só do time — comentário de cliente não tem perfil). Um select
  // em profiles pros ids distintos, mapeado por id → avatar_url.
  const autorIds = [...new Set(comentsRaw.filter((c) => c.autor_tipo === "time" && c.autor_id).map((c) => c.autor_id as string))];
  const avatarPorId = new Map<string, string | null>();
  if (autorIds.length) {
    const { data: perfis } = await sb.from("profiles").select("id, avatar_url").in("id", autorIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (perfis ?? []) as any[]) avatarPorId.set(p.id, p.avatar_url ?? null);
  }
  const porVersao = new Map<string, Comentario[]>();
  for (const c of comentsRaw) {
    c.autor_avatar = c.autor_tipo === "time" && c.autor_id ? (avatarPorId.get(c.autor_id) ?? null) : null;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aprovacaoToken: (rv as any).aprovacao_token ?? null,
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

/**
 * Todos os vídeos (review_video) de uma tarefa/bloco, com o essencial pra listar.
 * Batcheado em 3 queries (evita N+1): antes fazia 1+2·N — com 11 vídeos eram
 * ~23 idas ao banco em sequência, o que deixava a tarefa lenta pra abrir.
 */
export async function getReviewsDaTarefa(taskId: string, userId: string): Promise<VideoDoBloco[]> {
  const sb = createServiceRoleClient() as SB;
  const { data: rvs } = await sb
    .from("review_video")
    .select("id, titulo, status")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  const lista = (rvs ?? []) as Array<{ id: string; titulo: string; status: ReviewStatus }>;
  if (lista.length === 0) return [];
  const reviewIds = lista.map((r) => r.id);

  // Todas as versões de todos os reviews numa query só; a mais recente por review
  // é a 1ª ocorrência (ordenado por numero desc).
  const { data: versoesData } = await sb
    .from("review_versao")
    .select("id, review_video_id, bunny_video_id, pronto, numero")
    .in("review_video_id", reviewIds)
    .order("numero", { ascending: false });
  const atualPorReview = new Map<string, { id: string; bunny_video_id: string; pronto: boolean }>();
  for (const v of (versoesData ?? []) as Array<{ id: string; review_video_id: string; bunny_video_id: string; pronto: boolean; numero: number }>) {
    if (!atualPorReview.has(v.review_video_id)) {
      atualPorReview.set(v.review_video_id, { id: v.id, bunny_video_id: v.bunny_video_id, pronto: v.pronto });
    }
  }

  // Progresso assistido do user pra todas as versões atuais numa query só.
  const versaoIds = [...atualPorReview.values()].map((v) => v.id);
  const assistidoPorVersao = new Map<string, number>();
  if (versaoIds.length > 0) {
    const { data: aData } = await sb
      .from("review_assistido")
      .select("versao_id, pct_max")
      .eq("user_id", userId)
      .in("versao_id", versaoIds);
    for (const a of (aData ?? []) as Array<{ versao_id: string; pct_max: number }>) {
      assistidoPorVersao.set(a.versao_id, (a.pct_max as number | undefined) ?? 0);
    }
  }

  return lista.map((rv) => {
    const atual = atualPorReview.get(rv.id);
    return {
      reviewId: rv.id, titulo: rv.titulo, status: rv.status,
      thumbUrl: atual ? urlThumbnail(atual.bunny_video_id) : "",
      versaoAtualId: atual?.id ?? null,
      prontoAtual: atual?.pronto ?? false,
      assistidoPct: atual ? (assistidoPorVersao.get(atual.id) ?? 0) : 0,
    };
  });
}
