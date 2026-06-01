// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { EditorIaStatus } from "./tipos";

export interface EditorIaJobRow {
  id: string;
  status: EditorIaStatus;
  instrucao: string | null;
  video_url: string | null;
  video_duracao_segundos: number | null;
  transcricao: unknown | null;
  edit_plan: unknown | null;
  output_url: string | null;
  srt_url: string | null;
  shotstack_render_id: string | null;
  erro: string | null;
  created_at: string;
}

const COLS =
  "id, status, instrucao, video_url, video_duracao_segundos, transcricao, edit_plan, output_url, srt_url, shotstack_render_id, erro, created_at";

export async function listMeusJobs(userId: string, limit = 50): Promise<EditorIaJobRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("editor_ia_jobs")
    .select(COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[editor-ia] listMeusJobs", error.message);
    return [];
  }
  return (data ?? []) as EditorIaJobRow[];
}

export async function getJob(
  id: string,
): Promise<(EditorIaJobRow & { user_id: string; organization_id: string }) | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("editor_ia_jobs")
    .select(`${COLS}, user_id, organization_id`)
    .eq("id", id)
    .maybeSingle();
  return (data as (EditorIaJobRow & { user_id: string; organization_id: string }) | null) ?? null;
}

/** Jobs que o worker deve avancar (transcrevendo/planejando/renderizando). */
export async function listJobsToProcess(
  limit = 5,
): Promise<Array<EditorIaJobRow & { user_id: string; organization_id: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("editor_ia_jobs")
    .select(`${COLS}, user_id, organization_id`)
    .in("status", ["transcrevendo", "planejando", "renderizando"])
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as Array<EditorIaJobRow & { user_id: string; organization_id: string }>;
}
