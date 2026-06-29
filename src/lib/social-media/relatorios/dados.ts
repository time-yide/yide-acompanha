// SERVER ONLY — agrega os dados do relatório de redes sociais.
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PostRelatorio {
  id: string;
  thumb: string | null;
  legenda: string | null;
  formato: string;
  redes: string[];
  publicado_em: string | null;
  alcance: number;
  curtidas: number;
  comentarios: number;
  salvamentos: number;
  compartilhamentos: number;
  engajamento: number;
}

export interface DadosRelatorioSocial {
  totais: {
    posts: number;
    alcance: number;
    curtidas: number;
    comentarios: number;
    salvamentos: number;
    compartilhamentos: number;
    engajamento: number;
  };
  posts: PostRelatorio[];
  topPosts: PostRelatorio[]; // até 3, por engajamento
}

const METRICA_KEYS = [
  "alcance", "curtidas", "comentarios", "salvamentos", "compartilhamentos", "engajamento",
] as const;

export interface PostRaw {
  id: string;
  legenda: string | null;
  formato: string;
  redes: string[] | null;
  midias: string[] | null;
  publicado_em: string | null;
}
export interface MetricaRaw {
  post_id: string;
  metrica: string;
  valor: number;
}

/** Agregação pura (testável): junta posts + métricas → totais + lista + topPosts. */
export function agregarRelatorio(
  postsLista: PostRaw[],
  metricasRows: MetricaRaw[],
): DadosRelatorioSocial {
  const metricasPorPost = new Map<string, Record<string, number>>();
  for (const m of metricasRows) {
    const acc = metricasPorPost.get(m.post_id) ?? {};
    acc[m.metrica] = (acc[m.metrica] ?? 0) + (Number(m.valor) || 0);
    metricasPorPost.set(m.post_id, acc);
  }

  const posts: PostRelatorio[] = postsLista.map((p) => {
    const m = metricasPorPost.get(p.id) ?? {};
    return {
      id: p.id,
      thumb: Array.isArray(p.midias) && p.midias.length > 0 ? p.midias[0] : null,
      legenda: p.legenda ?? null,
      formato: p.formato,
      redes: Array.isArray(p.redes) ? p.redes : [],
      publicado_em: p.publicado_em ?? null,
      alcance: m.alcance ?? 0,
      curtidas: m.curtidas ?? 0,
      comentarios: m.comentarios ?? 0,
      salvamentos: m.salvamentos ?? 0,
      compartilhamentos: m.compartilhamentos ?? 0,
      engajamento: m.engajamento ?? 0,
    };
  });

  const totais = {
    posts: posts.length,
    alcance: 0, curtidas: 0, comentarios: 0, salvamentos: 0, compartilhamentos: 0, engajamento: 0,
  };
  for (const p of posts) {
    for (const k of METRICA_KEYS) totais[k] += p[k];
  }

  const topPosts = [...posts].sort((a, b) => b.engajamento - a.engajamento).slice(0, 3);
  return { totais, posts, topPosts };
}

/** Monta os dados agregados de um cliente num período (inclui o dia fim). */
export async function montarDadosRelatorio(
  clienteId: string,
  periodoInicio: string, // YYYY-MM-DD
  periodoFim: string, // YYYY-MM-DD
): Promise<DadosRelatorioSocial> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data: postsRaw } = await sbAny
    .from("social_media_posts")
    .select("id, legenda, formato, redes, midias, publicado_em")
    .eq("client_id", clienteId)
    .eq("status", "publicado")
    .is("archived_at", null)
    .gte("publicado_em", `${periodoInicio}T00:00:00.000Z`)
    .lte("publicado_em", `${periodoFim}T23:59:59.999Z`)
    .order("publicado_em", { ascending: false });

  const postsLista = (postsRaw ?? []) as PostRaw[];
  const ids = postsLista.map((p) => p.id);

  let metricasRows: MetricaRaw[] = [];
  if (ids.length > 0) {
    const { data: mets } = await sbAny
      .from("social_media_metricas")
      .select("post_id, metrica, valor")
      .in("post_id", ids);
    metricasRows = (mets ?? []) as MetricaRaw[];
  }

  return agregarRelatorio(postsLista, metricasRows);
}
