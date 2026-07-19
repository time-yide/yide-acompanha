// SERVER — registro de visita nas páginas públicas de post.
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ehBot } from "./insights-calc";

/**
 * Registra uma visita a um post publicado (fire-and-forget, via `after`).
 * Ignora bots/crawlers e nunca lança: se falhar, só loga — não pode derrubar
 * a página pública. Resolve o id pelo slug aqui pra manter o tipo público sem id.
 */
export async function registrarVisitaPorSlug(orgId: string, slug: string, userAgent: string): Promise<void> {
  if (ehBot(userAgent)) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = createServiceRoleClient();
    const { data } = await sb.from("blog_posts").select("id")
      .eq("organization_id", orgId).eq("slug", slug).eq("status", "publicado").maybeSingle();
    if (!data?.id) return;
    await sb.from("blog_post_views").insert({ post_id: data.id, organization_id: orgId });
  } catch (e) {
    console.error("[blog] registrarVisitaPorSlug", e);
  }
}
