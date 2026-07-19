import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Canal } from "./config";

export interface PostRow { id: string; canal: string; tema: string; conteudo: string; hashtags: string[]; status: string; created_at: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return createServiceRoleClient(); }

export async function getOrgPadrao(): Promise<string | null> {
  const { data } = await sb().from("organizations").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}
export async function listPostsPresenca(orgId: string, canal: Canal): Promise<PostRow[]> {
  const { data } = await sb().from("presenca_posts").select("id, canal, tema, conteudo, hashtags, status, created_at")
    .eq("organization_id", orgId).eq("canal", canal).neq("status", "arquivado").order("created_at", { ascending: false });
  return (data ?? []) as PostRow[];
}
export async function getChecklistFeitos(orgId: string, canal: Canal): Promise<string[]> {
  const { data } = await sb().from("presenca_checklist").select("feitos").eq("organization_id", orgId).eq("canal", canal).maybeSingle();
  const f = (data as { feitos?: unknown } | null)?.feitos;
  return Array.isArray(f) ? f.filter((x): x is string => typeof x === "string") : [];
}
