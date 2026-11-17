import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function autoAgendarPostsAprovados(): Promise<{
  updated: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const { data: posts } = await sb
    .from("social_media_posts")
    .select("id")
    .eq("status", "aprovado")
    .not("agendar_para", "is", null)
    .gt("agendar_para", new Date().toISOString())
    .is("archived_at", null);

  if (!posts || posts.length === 0) return { updated: 0 };

  const ids = (posts as Array<{ id: string }>).map((p) => p.id);

  const { count } = await sb
    .from("social_media_posts")
    .update({ status: "agendado" })
    .in("id", ids)
    .select("id", { count: "exact", head: true });

  return { updated: count ?? ids.length };
}
