import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { urlPlaylist, urlThumbnail } from "@/lib/bunny/client";
import type { ReviewStatus, AutorTipo } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface ReviewListItem { id: string; titulo: string; status: ReviewStatus; clienteNome: string | null; created_at: string }
export interface Comentario { id: string; autor_tipo: AutorTipo; autor_nome: string; tempo_seg: number; corpo: string; resolvido: boolean; created_at: string }
export interface Versao { id: string; numero: number; bunny_video_id: string; pronto: boolean; playlistUrl: string; thumbUrl: string; comentarios: Comentario[] }
export interface ReviewFull { id: string; titulo: string; status: ReviewStatus; clienteNome: string | null; versoes: Versao[] }

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

export async function carregarReview(id: string): Promise<ReviewFull | null> {
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb
    .from("review_video")
    .select("id, titulo, status, clients(nome)")
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
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    id: rv.id, titulo: rv.titulo, status: rv.status, clienteNome: (rv as any).clients?.nome ?? null,
    versoes: vs.map((v) => ({
      id: v.id, numero: v.numero, bunny_video_id: v.bunny_video_id, pronto: v.pronto,
      playlistUrl: urlPlaylist(v.bunny_video_id), thumbUrl: urlThumbnail(v.bunny_video_id),
      comentarios: porVersao.get(v.id) ?? [],
    })),
  };
}
