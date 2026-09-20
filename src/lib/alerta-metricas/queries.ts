import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface ClientMetricsComparison {
  clientId: string;
  clienteNome: string;
  assessorId: string | null;
  assessorNome: string | null;
  assessorTelefone: string | null;
  semanaAtual: AggregatedMetrics;
  semanaAnterior: AggregatedMetrics;
  variacao: Record<keyof AggregatedMetrics, number>;
}

interface AggregatedMetrics {
  alcance: number;
  curtidas: number;
  comentarios: number;
  salvamentos: number;
  compartilhamentos: number;
  engajamento: number;
}

const EMPTY: AggregatedMetrics = { alcance: 0, curtidas: 0, comentarios: 0, salvamentos: 0, compartilhamentos: 0, engajamento: 0 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function aggregateMetrics(sb: any, postIds: string[]): Promise<AggregatedMetrics> {
  if (postIds.length === 0) return { ...EMPTY };
  const { data } = await sb
    .from("social_media_metricas")
    .select("metrica, valor")
    .in("post_id", postIds);

  const result = { ...EMPTY };
  for (const row of (data ?? []) as { metrica: string; valor: number }[]) {
    const key = row.metrica as keyof AggregatedMetrics;
    if (key in result) result[key] += row.valor ?? 0;
  }
  result.engajamento = result.curtidas + result.comentarios + result.salvamentos + result.compartilhamentos;
  return result;
}

function calcVariacao(atual: number, anterior: number): number {
  if (anterior === 0) return 0;
  return Math.round(((atual - anterior) / anterior) * 100 * 10) / 10;
}

export async function getClientsWithMetricsDrop(
  orgId: string,
  thresholdPct: number = -25,
): Promise<ClientMetricsComparison[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() - 1);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 6);

  const prevEnd = new Date(weekStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 6);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, assessor_id, instagram_business_id")
    .eq("organization_id", orgId)
    .eq("status", "ativo")
    .not("instagram_business_id", "is", null);

  if (!clients || clients.length === 0) return [];

  type ClientRow = { id: string; nome: string; assessor_id: string | null; instagram_business_id: string | null };

  const assessorIds = new Set<string>();
  for (const c of clients as ClientRow[]) {
    if (c.assessor_id) assessorIds.add(c.assessor_id);
  }

  const assessorMap = new Map<string, { nome: string; telefone: string | null }>();
  if (assessorIds.size > 0) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, nome, telefone")
      .in("id", [...assessorIds]);
    for (const p of (profiles ?? []) as { id: string; nome: string; telefone: string | null }[]) {
      assessorMap.set(p.id, { nome: p.nome, telefone: p.telefone });
    }
  }

  const results: ClientMetricsComparison[] = [];

  for (const client of clients as ClientRow[]) {
    const { data: postsThisWeek } = await sb
      .from("social_media_posts")
      .select("id")
      .eq("client_id", client.id)
      .eq("status", "publicado")
      .gte("publicado_em", fmt(weekStart))
      .lte("publicado_em", fmt(weekEnd) + "T23:59:59");

    const { data: postsPrevWeek } = await sb
      .from("social_media_posts")
      .select("id")
      .eq("client_id", client.id)
      .eq("status", "publicado")
      .gte("publicado_em", fmt(prevStart))
      .lte("publicado_em", fmt(prevEnd) + "T23:59:59");

    const thisIds = ((postsThisWeek ?? []) as { id: string }[]).map((p) => p.id);
    const prevIds = ((postsPrevWeek ?? []) as { id: string }[]).map((p) => p.id);

    if (prevIds.length === 0) continue;

    const semanaAtual = await aggregateMetrics(sb, thisIds);
    const semanaAnterior = await aggregateMetrics(sb, prevIds);

    const variacao = {
      alcance: calcVariacao(semanaAtual.alcance, semanaAnterior.alcance),
      curtidas: calcVariacao(semanaAtual.curtidas, semanaAnterior.curtidas),
      comentarios: calcVariacao(semanaAtual.comentarios, semanaAnterior.comentarios),
      salvamentos: calcVariacao(semanaAtual.salvamentos, semanaAnterior.salvamentos),
      compartilhamentos: calcVariacao(semanaAtual.compartilhamentos, semanaAnterior.compartilhamentos),
      engajamento: calcVariacao(semanaAtual.engajamento, semanaAnterior.engajamento),
    };

    const hasSignificantDrop =
      variacao.engajamento <= thresholdPct || variacao.alcance <= thresholdPct;

    if (!hasSignificantDrop) continue;

    const assessor = client.assessor_id ? assessorMap.get(client.assessor_id) : null;

    results.push({
      clientId: client.id,
      clienteNome: client.nome,
      assessorId: client.assessor_id,
      assessorNome: assessor?.nome ?? null,
      assessorTelefone: assessor?.telefone ?? null,
      semanaAtual,
      semanaAnterior,
      variacao,
    });
  }

  return results;
}
