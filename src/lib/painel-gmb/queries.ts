// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface ClienteSemGmb {
  id: string;
  nome: string;
}

/**
 * Lista clientes ativos que AINDA não têm GMB cadastrado.
 * Usado pelo dialog "Adicionar GMB" do painel pra popular o seletor.
 */
export async function listClientesSemGmb(): Promise<ClienteSemGmb[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data } = await sb
    .from("clients")
    .select("id, nome, gmb_link, gmb_place_id")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .order("nome");
  const all = (data ?? []) as Array<{
    id: string;
    nome: string;
    gmb_link: string | null;
    gmb_place_id: string | null;
  }>;
  return all
    .filter((c) => !c.gmb_link && !c.gmb_place_id)
    .map((c) => ({ id: c.id, nome: c.nome }));
}

export interface GmbClienteRow {
  id: string;
  nome: string;
  gmb_link: string | null;
  gmb_place_id: string | null;
  gmb_rating: number | null;
  gmb_review_count: number | null;
  gmb_last_update_at: string | null;
  /** Variação de rating vs 30 dias atrás (null se sem histórico). */
  rating_delta_30d: number | null;
  /** Variação de review_count vs 30 dias atrás. */
  reviews_delta_30d: number | null;
}

export interface PainelGmbSummary {
  totalMonitorados: number;
  /** Clientes com pelo menos um dado preenchido. */
  totalComDados: number;
  /** Média ponderada de notas (só clientes com rating). */
  notaMedia: number | null;
  /** Soma de todos os reviews. */
  totalReviews: number;
  /** Quantos clientes melhoraram nota nos últimos 30 dias. */
  melhoraram30d: number;
  /** Quantos pioraram. */
  pioraram30d: number;
}

/**
 * Lista todos os clientes ativos com dados GMB, e calcula deltas vs 30
 * dias atrás (via snapshots). Usado pelo painel /painel-gmb.
 *
 * Usa service-role pra ler clients + snapshots em paralelo.
 */
export async function listClientesGmb(): Promise<{
  clientes: GmbClienteRow[];
  summary: PainelGmbSummary;
}> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  // 1) Clientes ativos com algum dado GMB cadastrado
  const { data: clientsData } = await sb
    .from("clients")
    .select("id, nome, gmb_link, gmb_place_id, gmb_rating, gmb_review_count, gmb_last_update_at")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .order("nome");
  const clients = (clientsData ?? []) as Array<{
    id: string;
    nome: string;
    gmb_link: string | null;
    gmb_place_id: string | null;
    gmb_rating: number | string | null;
    gmb_review_count: number | null;
    gmb_last_update_at: string | null;
  }>;

  if (clients.length === 0) {
    return {
      clientes: [],
      summary: {
        totalMonitorados: 0,
        totalComDados: 0,
        notaMedia: null,
        totalReviews: 0,
        melhoraram30d: 0,
        pioraram30d: 0,
      },
    };
  }

  // 2) Snapshots dos últimos 35 dias pra calcular delta vs 30d atrás
  const since = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const clientIds = clients.map((c) => c.id);
  const { data: snapshotsData } = await sb
    .from("client_gmb_snapshots")
    .select("client_id, captured_at, rating, review_count")
    .in("client_id", clientIds)
    .gte("captured_at", since)
    .order("captured_at", { ascending: true });
  const snapshots = (snapshotsData ?? []) as Array<{
    client_id: string;
    captured_at: string;
    rating: number | string | null;
    review_count: number | null;
  }>;

  // 3) Pra cada cliente, acha o snapshot mais antigo dentro da janela de
  //    25-35 dias atrás (margem pra cobrir variações de execução do cron).
  const cutoffStart = Date.now() - 35 * 24 * 60 * 60 * 1000;
  const cutoffEnd = Date.now() - 25 * 24 * 60 * 60 * 1000;
  const baselineByClient = new Map<string, { rating: number | null; reviewCount: number | null }>();
  for (const s of snapshots) {
    const t = new Date(s.captured_at).getTime();
    if (t < cutoffStart || t > cutoffEnd) continue;
    if (!baselineByClient.has(s.client_id)) {
      baselineByClient.set(s.client_id, {
        rating: s.rating !== null ? Number(s.rating) : null,
        reviewCount: s.review_count,
      });
    }
  }

  // 4) Monta rows com deltas
  const clientes: GmbClienteRow[] = clients.map((c) => {
    const currentRating = c.gmb_rating !== null ? Number(c.gmb_rating) : null;
    const baseline = baselineByClient.get(c.id);
    const rating_delta_30d =
      currentRating !== null && baseline?.rating !== null && baseline?.rating !== undefined
        ? Number((currentRating - baseline.rating).toFixed(2))
        : null;
    const reviews_delta_30d =
      c.gmb_review_count !== null && baseline?.reviewCount !== null && baseline?.reviewCount !== undefined
        ? c.gmb_review_count - baseline.reviewCount
        : null;
    return {
      id: c.id,
      nome: c.nome,
      gmb_link: c.gmb_link,
      gmb_place_id: c.gmb_place_id,
      gmb_rating: currentRating,
      gmb_review_count: c.gmb_review_count,
      gmb_last_update_at: c.gmb_last_update_at,
      rating_delta_30d,
      reviews_delta_30d,
    };
  });

  // 5) Summary
  const comDados = clientes.filter((c) => c.gmb_link || c.gmb_rating !== null);
  const comRating = clientes.filter((c) => c.gmb_rating !== null);
  const notaMedia =
    comRating.length > 0
      ? comRating.reduce((acc, c) => acc + (c.gmb_rating ?? 0), 0) / comRating.length
      : null;
  const totalReviews = clientes.reduce((acc, c) => acc + (c.gmb_review_count ?? 0), 0);
  const melhoraram30d = clientes.filter((c) => c.rating_delta_30d !== null && c.rating_delta_30d > 0).length;
  const pioraram30d = clientes.filter((c) => c.rating_delta_30d !== null && c.rating_delta_30d < 0).length;

  return {
    clientes,
    summary: {
      totalMonitorados: clientes.length,
      totalComDados: comDados.length,
      notaMedia,
      totalReviews,
      melhoraram30d,
      pioraram30d,
    },
  };
}
