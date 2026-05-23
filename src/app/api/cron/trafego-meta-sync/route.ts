import { NextResponse, type NextRequest } from "next/server";
import { syncMetaForClient, listClientesParaSync } from "@/lib/trafego/meta-sync";

/**
 * Cron: sincroniza métricas do Meta Ads pra todos os clientes ativos com
 * `meta_ad_account_id` cadastrado.
 *
 * Schedule (vercel.json): `0 4 * * *` = 4h UTC = 1h Cuiabá (madrugada).
 *
 * Por cliente: puxa últimos 7 dias (acomoda atrasos do Meta - eles às vezes
 * só fecham o número do dia 24-48h depois). Sync é idempotente via upsert
 * `(campanha_id, data, metrica_key)`.
 *
 * Erros por cliente NÃO abortam o cron - cada cliente roda isolado e o
 * resumo final mostra o que deu certo/errado.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.META_SYSTEM_USER_TOKEN) {
    return NextResponse.json(
      {
        error: "META_SYSTEM_USER_TOKEN não configurado. Veja docs/trafego-meta-setup.md",
        skipped: true,
      },
      { status: 200 },
    );
  }

  const startedAt = Date.now();
  const clientes = await listClientesParaSync();

  const results: Array<{
    client_id: string;
    nome: string;
    ok: boolean;
    campaigns?: number;
    metrics?: number;
    error?: string;
  }> = [];

  // Roda em série pra não estourar rate limit do Meta. Pra agência com
  // <50 clientes em sync, série leva <5min - dentro do timeout do Vercel
  // pra cron jobs (10min na free, 15min na pro).
  for (const cliente of clientes) {
    try {
      const r = await syncMetaForClient(cliente.id, { daysBack: 7 });
      results.push({
        client_id: cliente.id,
        nome: cliente.nome,
        ok: r.ok,
        campaigns: r.campaigns_upserted,
        metrics: r.metrics_upserted,
        error: r.error,
      });
    } catch (e) {
      results.push({
        client_id: cliente.id,
        nome: cliente.nome,
        ok: false,
        error: String(e),
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const errCount = results.length - okCount;
  const duration_ms = Date.now() - startedAt;

  return NextResponse.json({
    success: true,
    duration_ms,
    total_clients: clientes.length,
    ok: okCount,
    failed: errCount,
    results,
  });
}
