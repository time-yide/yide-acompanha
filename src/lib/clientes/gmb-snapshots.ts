// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type GmbSnapshotSource = "manual" | "cron" | "refresh_button";

export interface GmbSnapshot {
  client_id: string;
  rating: number | null;
  review_count: number | null;
  captured_at: string;
  source: GmbSnapshotSource;
}

/**
 * UPSERT snapshot do dia atual pra um cliente. Dedupe via unique index
 * em (client_id, day). 1 snapshot por dia por cliente — última atualização
 * do dia ganha.
 *
 * Best-effort: erros são logados mas não derrubam o caller (a função
 * principal é só "log o histórico", não interrompe atualização principal
 * do cliente se snapshot falhar).
 */
export async function recordGmbSnapshot(args: {
  clientId: string;
  rating: number | null;
  reviewCount: number | null;
  source: GmbSnapshotSource;
}): Promise<void> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const payload = {
    client_id: args.clientId,
    rating: args.rating,
    review_count: args.reviewCount,
    captured_at: new Date().toISOString(),
    source: args.source,
  };
  // Tenta UPDATE primeiro (mesmo dia) — se 0 rows afetadas, faz INSERT.
  // Mais eficiente que UPSERT cego porque a maioria dos dias só tem 1 entrada.
  const today = new Date();
  const cuiabaToday = new Date(today.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    // Tenta encontrar snapshot do dia
    const { data: existing } = await sb
      .from("client_gmb_snapshots")
      .select("id")
      .eq("client_id", args.clientId)
      .gte("captured_at", `${cuiabaToday}T00:00:00-04:00`)
      .lt("captured_at", `${cuiabaToday}T23:59:59-04:00`)
      .maybeSingle();

    if (existing?.id) {
      // Atualiza o existente
      await sb
        .from("client_gmb_snapshots")
        .update({
          rating: payload.rating,
          review_count: payload.review_count,
          captured_at: payload.captured_at,
          source: payload.source,
        })
        .eq("id", existing.id);
    } else {
      // Insere novo
      await sb.from("client_gmb_snapshots").insert(payload);
    }
  } catch (e) {
    console.error("[gmb-snapshots] failed:", e);
  }
}

export interface GmbTimeSeriesPoint {
  date: string; // YYYY-MM-DD
  rating: number | null;
  review_count: number | null;
}

/**
 * Série temporal dos últimos N dias pra um cliente. Usado pra plotar gráfico
 * de evolução no painel.
 */
export async function getGmbTimeSeries(
  clientId: string,
  days = 90,
): Promise<GmbTimeSeriesPoint[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("client_gmb_snapshots")
    .select("captured_at, rating, review_count")
    .eq("client_id", clientId)
    .gte("captured_at", since)
    .order("captured_at", { ascending: true });
  const rows = (data ?? []) as Array<{
    captured_at: string;
    rating: number | string | null;
    review_count: number | null;
  }>;
  return rows.map((r) => ({
    date: r.captured_at.slice(0, 10),
    rating: r.rating !== null ? Number(r.rating) : null,
    review_count: r.review_count,
  }));
}
