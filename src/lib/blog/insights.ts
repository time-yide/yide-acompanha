// SERVER — agrega as métricas do blog pro painel de Insights.
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { agruparVisitasPorDia, contarVisitasPorPost, rankearKeywords } from "./insights-calc";

export interface TopPost {
  id: string;
  titulo: string;
  slug: string;
  visitas: number;
}

export interface InsightsData {
  postsPublicados: number;
  visitasTotal: number;
  visitas7d: number;
  visitas30d: number;
  porDia: { dia: string; total: number }[];
  topPosts: TopPost[];
  keywords: { keyword: string; total: number }[];
}

const DIAS_JANELA = 30;
const DIA_MS = 86_400_000;

const VAZIO: InsightsData = {
  postsPublicados: 0, visitasTotal: 0, visitas7d: 0, visitas30d: 0,
  porDia: [], topPosts: [], keywords: [],
};

export async function getBlogInsights(orgId: string): Promise<InsightsData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = createServiceRoleClient();
  const agora = Date.now();
  const iso7 = new Date(agora - 7 * DIA_MS).toISOString();
  const iso30 = new Date(agora - DIAS_JANELA * DIA_MS).toISOString();

  try {
    const [postsRes, totalRes, r7, r30, viewsRes] = await Promise.all([
      sb.from("blog_posts").select("id, titulo, slug, keywords")
        .eq("organization_id", orgId).eq("status", "publicado"),
      sb.from("blog_post_views").select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      sb.from("blog_post_views").select("id", { count: "exact", head: true })
        .eq("organization_id", orgId).gte("created_at", iso7),
      sb.from("blog_post_views").select("id", { count: "exact", head: true })
        .eq("organization_id", orgId).gte("created_at", iso30),
      sb.from("blog_post_views").select("post_id, created_at")
        .eq("organization_id", orgId).gte("created_at", iso30).limit(50_000),
    ]);

    const publicados: { id: string; titulo: string; slug: string; keywords: string[] }[] = postsRes.data ?? [];
    const janela: { post_id: string; created_at: string }[] = viewsRes.data ?? [];

    const porDia = agruparVisitasPorDia(janela.map((v) => v.created_at), agora, DIAS_JANELA);
    const contagem = contarVisitasPorPost(janela.map((v) => v.post_id));
    const topPosts: TopPost[] = publicados
      .map((p) => ({ id: p.id, titulo: p.titulo, slug: p.slug, visitas: contagem[p.id] ?? 0 }))
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, 10);
    const keywords = rankearKeywords(publicados.map((p) => p.keywords ?? []), 15);

    return {
      postsPublicados: publicados.length,
      visitasTotal: totalRes.count ?? 0,
      visitas7d: r7.count ?? 0,
      visitas30d: r30.count ?? 0,
      porDia, topPosts, keywords,
    };
  } catch (e) {
    console.error("[blog] getBlogInsights", e);
    return VAZIO;
  }
}
