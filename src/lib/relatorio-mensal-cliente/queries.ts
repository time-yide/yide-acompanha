import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface ClientMonthlyMetrics {
  clientId: string;
  clienteNome: string;
  telefone: string;
  postsPublicados: number;
  postsPorFormato: { feed: number; story: number; reel: number; outro: number };
  metricas: {
    alcance: number;
    curtidas: number;
    comentarios: number;
    salvamentos: number;
    compartilhamentos: number;
    engajamento: number;
  };
  metricasMesAnterior: {
    alcance: number;
    curtidas: number;
    comentarios: number;
    salvamentos: number;
    compartilhamentos: number;
    engajamento: number;
  };
}

const EMPTY_METRICS = { alcance: 0, curtidas: 0, comentarios: 0, salvamentos: 0, compartilhamentos: 0, engajamento: 0 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function aggregatePostMetrics(sb: any, postIds: string[]) {
  if (postIds.length === 0) return { ...EMPTY_METRICS };
  const { data } = await sb
    .from("social_media_metricas")
    .select("metrica, valor")
    .in("post_id", postIds);

  const result = { ...EMPTY_METRICS };
  for (const row of (data ?? []) as { metrica: string; valor: number }[]) {
    const key = row.metrica as keyof typeof result;
    if (key in result && key !== "engajamento") result[key] += row.valor ?? 0;
  }
  result.engajamento = result.curtidas + result.comentarios + result.salvamentos + result.compartilhamentos;
  return result;
}

export async function getClientMonthlyReports(
  orgId: string,
  mesInicio: string,
  mesFim: string,
  mesAnteriorInicio: string,
  mesAnteriorFim: string,
): Promise<ClientMonthlyMetrics[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, telefone, tipo_pacote")
    .eq("organization_id", orgId)
    .eq("status", "ativo")
    .not("telefone", "is", null);

  if (!clients || clients.length === 0) return [];

  type ClientRow = { id: string; nome: string; telefone: string; tipo_pacote: string };
  const results: ClientMonthlyMetrics[] = [];

  for (const client of clients as ClientRow[]) {
    const { data: posts } = await sb
      .from("social_media_posts")
      .select("id, formato")
      .eq("client_id", client.id)
      .eq("status", "publicado")
      .gte("publicado_em", mesInicio)
      .lte("publicado_em", mesFim + "T23:59:59");

    const postsList = (posts ?? []) as { id: string; formato: string | null }[];
    if (postsList.length === 0) continue;

    const postsPorFormato = { feed: 0, story: 0, reel: 0, outro: 0 };
    for (const p of postsList) {
      const f = p.formato as keyof typeof postsPorFormato;
      if (f in postsPorFormato) postsPorFormato[f]++;
      else postsPorFormato.outro++;
    }

    const postIds = postsList.map((p) => p.id);
    const metricas = await aggregatePostMetrics(sb, postIds);

    const { data: prevPosts } = await sb
      .from("social_media_posts")
      .select("id")
      .eq("client_id", client.id)
      .eq("status", "publicado")
      .gte("publicado_em", mesAnteriorInicio)
      .lte("publicado_em", mesAnteriorFim + "T23:59:59");

    const prevIds = ((prevPosts ?? []) as { id: string }[]).map((p) => p.id);
    const metricasMesAnterior = await aggregatePostMetrics(sb, prevIds);

    results.push({
      clientId: client.id,
      clienteNome: client.nome,
      telefone: client.telefone,
      postsPublicados: postsList.length,
      postsPorFormato,
      metricas,
      metricasMesAnterior,
    });
  }

  return results;
}
