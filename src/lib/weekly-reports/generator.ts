import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { WeeklyReportData, MetricaComparacao } from "./types";

function calcVariacao(atual: number, anterior: number): MetricaComparacao {
  const variacao =
    anterior > 0 ? ((atual - anterior) / anterior) * 100 : atual > 0 ? 100 : 0;
  return {
    valor: atual,
    anterior,
    variacao_pct: Math.round(variacao * 10) / 10,
  };
}

export async function generateWeeklyReport(
  clientId: string,
  orgId: string,
  semanaInicio: string,
  semanaFim: string
): Promise<WeeklyReportData> {
  const sb = createServiceRoleClient();
  const sbAny = sb as any;

  const { data: posts } = await sbAny
    .from("social_media_posts")
    .select("id, titulo, redes, formato, publicado_em")
    .eq("client_id", clientId)
    .eq("status", "publicado")
    .gte("publicado_em", semanaInicio)
    .lte("publicado_em", semanaFim + "T23:59:59");

  const postsDetalhes = (posts ?? []).map((p: any) => ({
    titulo: p.titulo ?? "",
    rede: (p.redes as string[])?.[0] ?? "instagram",
    formato: p.formato ?? "feed",
    publicado_em: p.publicado_em,
  }));

  const postIds = (posts ?? []).map((p: any) => p.id);
  const metricsThisWeek = await aggregateMetrics(sbAny, postIds);

  const prevStart = new Date(semanaInicio);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(semanaFim);
  prevEnd.setDate(prevEnd.getDate() - 7);

  const { data: prevPosts } = await sbAny
    .from("social_media_posts")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "publicado")
    .gte("publicado_em", prevStart.toISOString().slice(0, 10))
    .lte("publicado_em", prevEnd.toISOString().slice(0, 10) + "T23:59:59");

  const prevIds = (prevPosts ?? []).map((p: any) => p.id);
  const metricsPrev = await aggregateMetrics(sbAny, prevIds);

  return {
    posts_publicados: postsDetalhes.length,
    posts_detalhes: postsDetalhes,
    metricas: {
      alcance: calcVariacao(metricsThisWeek.alcance, metricsPrev.alcance),
      curtidas: calcVariacao(metricsThisWeek.curtidas, metricsPrev.curtidas),
      comentarios: calcVariacao(metricsThisWeek.comentarios, metricsPrev.comentarios),
      salvamentos: calcVariacao(metricsThisWeek.salvamentos, metricsPrev.salvamentos),
      compartilhamentos: calcVariacao(metricsThisWeek.compartilhamentos, metricsPrev.compartilhamentos),
      engajamento_total: calcVariacao(
        metricsThisWeek.curtidas + metricsThisWeek.comentarios + metricsThisWeek.salvamentos + metricsThisWeek.compartilhamentos,
        metricsPrev.curtidas + metricsPrev.comentarios + metricsPrev.salvamentos + metricsPrev.compartilhamentos
      ),
    },
  };
}

interface AggregatedMetrics {
  alcance: number;
  curtidas: number;
  comentarios: number;
  salvamentos: number;
  compartilhamentos: number;
}

async function aggregateMetrics(sb: any, postIds: string[]): Promise<AggregatedMetrics> {
  const empty = { alcance: 0, curtidas: 0, comentarios: 0, salvamentos: 0, compartilhamentos: 0 };
  if (postIds.length === 0) return empty;

  const { data } = await sb
    .from("social_media_metricas")
    .select("metrica, valor")
    .in("post_id", postIds);

  const result = { ...empty };
  for (const row of data ?? []) {
    const key = row.metrica as keyof AggregatedMetrics;
    if (key in result) result[key] += row.valor ?? 0;
  }
  return result;
}
