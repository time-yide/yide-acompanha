// src/app/api/cron/instagram-snapshots/route.ts
//
// Cron diário (00:30 Cuiabá = 04:30 UTC) que cria snapshot de cada
// cliente elegível com instagram_url cadastrado.

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchProfileSnapshot } from "@/lib/instagram-snapshots/scraper";
import { listClientesParaCron, getSnapshotSeRecente } from "@/lib/instagram-snapshots/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5min — bate Apify pra dezenas de perfis

const SKIP_IF_FRESHER_THAN_MS = 6 * 60 * 60 * 1000; // 6h: idempotência

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const clientes = await listClientesParaCron();
  if (clientes.length === 0) {
    return NextResponse.json({ ok: true, total: 0, refreshed: 0, skipped: 0, errors: 0 });
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  let refreshed = 0, skipped = 0, errors = 0;
  const batchSize = 5;
  for (let i = 0; i < clientes.length; i += batchSize) {
    const batch = clientes.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (c) => {
        // Idempotência: se cron rodou hoje há menos de 6h, pula.
        const recente = await getSnapshotSeRecente(c.id, SKIP_IF_FRESHER_THAN_MS);
        if (recente) return "skipped" as const;

        const snap = await fetchProfileSnapshot(c.instagram_url);
        const { error } = await sb.from("client_instagram_snapshots").insert({
          client_id: c.id,
          organization_id: c.organization_id,
          total_posts: snap.totalPosts,
          recent_posts: snap.recentPosts,
          scrape_status: snap.status,
          erro: snap.erro ?? null,
          triggered_by: "cron",
        });
        if (error) return "error" as const;
        return snap.status === "ok" ? "refreshed" : "error";
      }),
    );
    for (const r of results) {
      if (r === "skipped") skipped++;
      else if (r === "refreshed") refreshed++;
      else errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    total: clientes.length,
    refreshed,
    skipped,
    errors,
  });
}
