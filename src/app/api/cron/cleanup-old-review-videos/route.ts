import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { deletarVideo, bunnyConfigurado } from "@/lib/bunny/client";

/**
 * Cron diário: apaga do Bunny Stream os vídeos de review aprovados há 60+ dias.
 *
 * Cron schedule: 0 5 * * * (5h UTC = 2h BRT)
 *
 * O que apaga:
 *  - Vídeo do Bunny Stream (storage + CDN)
 *  - Limpa bunny_video_id na review_versao
 *
 * O que MANTÉM:
 *  - review_video (histórico de aprovação)
 *  - review_versao (metadados da versão, sem o vídeo)
 *  - review_comments
 */

const MAX_PER_RUN = 30;

interface CleanupRow {
  video_id: string;
  versao_id: string;
  bunny_video_id: string;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!bunnyConfigurado()) {
    return NextResponse.json({ skipped: "bunny_not_configured" });
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data, error } = await sb
    .from("review_videos_to_cleanup")
    .select("video_id, versao_id, bunny_video_id")
    .limit(MAX_PER_RUN);

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("schema cache") || msg.includes("does not exist")) {
      return NextResponse.json({ skipped: "migration_pending" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as CleanupRow[];
  if (rows.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const resultados: Array<{ versao_id: string; ok: boolean; error?: string }> = [];

  for (const row of rows) {
    try {
      await deletarVideo(row.bunny_video_id);

      const { error: dbError } = await sb
        .from("review_versao")
        .update({ bunny_video_id: null })
        .eq("id", row.versao_id);

      if (dbError) {
        resultados.push({ versao_id: row.versao_id, ok: false, error: dbError.message });
        continue;
      }

      resultados.push({ versao_id: row.versao_id, ok: true });
    } catch (e) {
      resultados.push({
        versao_id: row.versao_id,
        ok: false,
        error: (e as Error).message,
      });
    }
  }

  return NextResponse.json({
    deleted: resultados.filter((r) => r.ok).length,
    errors: resultados.filter((r) => !r.ok).length,
    resultados,
  });
}
