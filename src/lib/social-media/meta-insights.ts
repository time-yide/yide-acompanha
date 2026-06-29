// SERVER ONLY: do not import from client components
import { metaFetch } from "./meta-publish";

export type Metrica =
  | "alcance"
  | "curtidas"
  | "comentarios"
  | "salvamentos"
  | "compartilhamentos"
  | "engajamento";

export type PostMetricas = Partial<Record<Metrica, number>>;

export type InsightsResult = { metricas: PostMetricas } | { error: string };

interface IgInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value?: number }> }>;
}

const IG_METRIC_MAP: Record<string, Metrica> = {
  reach: "alcance",
  likes: "curtidas",
  comments: "comentarios",
  saved: "salvamentos",
  shares: "compartilhamentos",
  total_interactions: "engajamento",
};

export async function getInstagramMediaInsights(mediaId: string): Promise<InsightsResult> {
  const res = await metaFetch<IgInsightsResponse>(`/${mediaId}/insights`, {
    body: { metric: "reach,likes,comments,saved,shares,total_interactions" },
  });
  if (res.error || !res.data) return { error: res.error ?? "Sem dados de insights" };

  const metricas: PostMetricas = {};
  for (const item of res.data.data ?? []) {
    const key = IG_METRIC_MAP[item.name];
    const value = item.values?.[0]?.value;
    if (key && typeof value === "number") metricas[key] = value;
  }
  return { metricas };
}

interface FbFieldsResponse {
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}
interface FbInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value?: number }> }>;
}

export async function getFacebookPostInsights(postId: string): Promise<InsightsResult> {
  const fields = await metaFetch<FbFieldsResponse>(`/${postId}`, {
    body: { fields: "reactions.summary(true),comments.summary(true),shares" },
  });
  if (fields.error || !fields.data) return { error: fields.error ?? "Sem dados do post" };

  const metricas: PostMetricas = {};
  const reacoes = fields.data.reactions?.summary?.total_count;
  const coments = fields.data.comments?.summary?.total_count;
  const compart = fields.data.shares?.count;
  if (typeof reacoes === "number") metricas.curtidas = reacoes;
  if (typeof coments === "number") metricas.comentarios = coments;
  if (typeof compart === "number") metricas.compartilhamentos = compart;

  // Alcance (post_impressions_unique) - chamada separada; tolera falha.
  const ins = await metaFetch<FbInsightsResponse>(`/${postId}/insights`, {
    body: { metric: "post_impressions_unique" },
  });
  if (ins.data) {
    const alcance = ins.data.data?.find((d) => d.name === "post_impressions_unique")?.values?.[0]?.value;
    if (typeof alcance === "number") metricas.alcance = alcance;
  }
  return { metricas };
}
