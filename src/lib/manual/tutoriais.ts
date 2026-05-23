// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type TutorialSetor =
  | "adm"
  | "socio"
  | "comercial"
  | "coordenador"
  | "assessor"
  | "videomaker"
  | "designer"
  | "editor"
  | "audiovisual_chefe";

export const SETOR_LABEL: Record<TutorialSetor, string> = {
  adm: "Administração",
  socio: "Sócio",
  comercial: "Comercial",
  coordenador: "Coordenador",
  assessor: "Assessor",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
  audiovisual_chefe: "Coord. Audiovisual",
};

export const SETOR_ORDER: TutorialSetor[] = [
  "assessor",
  "coordenador",
  "videomaker",
  "audiovisual_chefe",
  "designer",
  "editor",
  "comercial",
  "socio",
  "adm",
];

export interface TutorialRow {
  id: string;
  titulo: string;
  descricao: string | null;
  setor: TutorialSetor | null;
  video_url: string;
  ordem: number;
  uploaded_by: string;
  uploaded_by_nome: string | null;
  created_at: string;
}

export async function listTutoriais(): Promise<TutorialRow[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data } = await sb
    .from("manual_tutoriais")
    .select("id, titulo, descricao, setor, video_url, ordem, uploaded_by, created_at")
    .order("setor", { ascending: true })
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as Array<{
    id: string;
    titulo: string;
    descricao: string | null;
    setor: TutorialSetor | null;
    video_url: string;
    ordem: number;
    uploaded_by: string;
    created_at: string;
  }>;
  if (rows.length === 0) return [];

  const uploaderIds = Array.from(new Set(rows.map((r) => r.uploaded_by)));
  const { data: profs } = await admin
    .from("profiles")
    .select("id, nome")
    .in("id", uploaderIds);
  const nameById = new Map(
    ((profs ?? []) as Array<{ id: string; nome: string }>).map((p) => [p.id, p.nome]),
  );

  return rows.map((r) => ({
    ...r,
    uploaded_by_nome: nameById.get(r.uploaded_by) ?? null,
  }));
}

/**
 * Converte URL de YouTube/Vimeo/Loom pra URL de embed. Retorna null se a URL
 * não for de uma plataforma conhecida (UI mostra link externo nesse caso).
 *
 * Aceita formatos:
 *   - youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
 *   - vimeo.com/ID, player.vimeo.com/video/ID
 *   - loom.com/share/ID, loom.com/embed/ID
 */
export function toEmbedUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");

  // YouTube
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const v = url.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
    }
    const shortsMatch = url.pathname.match(/^\/shorts\/([^/]+)/);
    if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
    const embedMatch = url.pathname.match(/^\/embed\/([^/]+)/);
    if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[1]}`;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
  }

  // Vimeo
  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
  }
  if (host === "player.vimeo.com") {
    return url.toString();
  }

  // Loom
  if (host === "loom.com") {
    const shareMatch = url.pathname.match(/^\/share\/([a-z0-9]+)/i);
    if (shareMatch) return `https://www.loom.com/embed/${shareMatch[1]}`;
    const embedMatch = url.pathname.match(/^\/embed\/([a-z0-9]+)/i);
    if (embedMatch) return url.toString();
  }

  return null;
}
