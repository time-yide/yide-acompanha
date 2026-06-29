// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getInstagramMediaInsights, getFacebookPostInsights, type PostMetricas } from "./meta-insights";

interface PostParaSync {
  id: string;
  instagram_post_id: string | null;
  facebook_post_id: string | null;
}

async function upsertMetricas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  postId: string,
  rede: "instagram" | "facebook",
  metricas: PostMetricas,
): Promise<void> {
  const rows = Object.entries(metricas).map(([metrica, valor]) => ({
    post_id: postId,
    rede,
    metrica,
    valor,
    coletado_em: new Date().toISOString(),
  }));
  if (rows.length === 0) return;
  await sb.from("social_media_metricas").upsert(rows, { onConflict: "post_id,rede,metrica" });
}

/** Sincroniza métricas de 1 post (IG e/ou FB). Retorna quantas redes deram certo. */
export async function sincronizarMetricasPost(postId: string): Promise<{ ok: number; erros: string[] }> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: post } = await sbAny
    .from("social_media_posts")
    .select("id, instagram_post_id, facebook_post_id")
    .eq("id", postId)
    .single();
  if (!post) return { ok: 0, erros: ["Post não encontrado"] };
  const p = post as PostParaSync;

  let ok = 0;
  const erros: string[] = [];

  if (p.instagram_post_id) {
    const r = await getInstagramMediaInsights(p.instagram_post_id);
    if ("error" in r) {
      erros.push(`IG: ${r.error}`);
    } else {
      await upsertMetricas(sbAny, postId, "instagram", r.metricas);
      ok++;
    }
  }
  if (p.facebook_post_id) {
    const r = await getFacebookPostInsights(p.facebook_post_id);
    if ("error" in r) {
      erros.push(`FB: ${r.error}`);
    } else {
      await upsertMetricas(sbAny, postId, "facebook", r.metricas);
      ok++;
    }
  }
  return { ok, erros };
}

/** Sincroniza posts publicados recentes (últimos 30 dias). Usado pelo cron. */
export async function sincronizarMetricasPendentes(limit = 50): Promise<{ checked: number; ok: number }> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: posts } = await sbAny
    .from("social_media_posts")
    .select("id, instagram_post_id, facebook_post_id, publicado_em")
    .eq("status", "publicado")
    .is("archived_at", null)
    .gte("publicado_em", desde)
    .limit(limit);

  const lista = (posts ?? []) as Array<PostParaSync & { publicado_em: string | null }>;
  let ok = 0;
  for (const p of lista) {
    if (!p.instagram_post_id && !p.facebook_post_id) continue;
    const r = await sincronizarMetricasPost(p.id);
    if (r.ok > 0) ok++;
  }
  return { checked: lista.length, ok };
}
