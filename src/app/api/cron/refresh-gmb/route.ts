import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchGmbByPlaceId } from "@/lib/clientes/gmb-places";
import { recordGmbSnapshot } from "@/lib/clientes/gmb-snapshots";
import { logAudit } from "@/lib/audit/log";

/**
 * Cron: refresh dos dados GMB de todos os clientes que têm `gmb_place_id`.
 * Roda 1x/dia, busca rating/userRatingCount fresco via Google Places API
 * (endpoint de Place Details — mais barato que searchText).
 *
 * Schedule (vercel.json): 1x/dia às 6h UTC = 2h Cuiabá (madrugada).
 *
 * Sem GOOGLE_PLACES_API_KEY: sai cedo, vira no-op (não erra).
 * Errors em clientes individuais não derrubam o cron — só logam e seguem.
 */

const MAX_PER_RUN = 200;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json({
      skipped: "GOOGLE_PLACES_API_KEY not configured",
      refreshed: 0,
    });
  }

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  // Pega clientes com place_id cadastrado, ativos, prioriza os de update mais antigo
  const { data: clientesData } = await sb
    .from("clients")
    .select("id, nome, gmb_place_id, gmb_last_update_at")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .not("gmb_place_id", "is", null)
    .order("gmb_last_update_at", { ascending: true, nullsFirst: true })
    .limit(MAX_PER_RUN);

  const clientes = (clientesData ?? []) as Array<{
    id: string;
    nome: string;
    gmb_place_id: string;
    gmb_last_update_at: string | null;
  }>;

  let refreshed = 0;
  let failed = 0;
  const errors: Array<{ client: string; error: string }> = [];

  for (const c of clientes) {
    try {
      const result = await fetchGmbByPlaceId(c.gmb_place_id, apiKey);
      if (!result) {
        failed += 1;
        errors.push({ client: c.nome, error: "Places API returned null" });
        continue;
      }
      const { error: updErr } = await sb
        .from("clients")
        .update({
          gmb_rating: result.rating,
          gmb_review_count: result.reviewCount,
          gmb_link: result.mapsUrl || undefined, // só sobrescreve se a API retornou
          gmb_last_update_at: new Date().toISOString(),
        })
        .eq("id", c.id);
      if (updErr) {
        failed += 1;
        errors.push({ client: c.nome, error: updErr.message });
        continue;
      }
      // Snapshot diário pro histórico (UPSERT por dia)
      await recordGmbSnapshot({
        clientId: c.id,
        rating: result.rating,
        reviewCount: result.reviewCount,
        source: "cron",
      });
      refreshed += 1;
    } catch (e) {
      failed += 1;
      errors.push({ client: c.nome, error: String(e) });
    }
  }

  // Audit log do cron (ator_id null = system)
  await logAudit({
    entidade: "clients",
    entidade_id: "gmb-cron",
    acao: "update",
    dados_depois: { refreshed, failed, errors: errors.slice(0, 10) },
    ator_id: null,
  });

  return NextResponse.json({
    total: clientes.length,
    refreshed,
    failed,
    errors: errors.slice(0, 10),
  });
}
