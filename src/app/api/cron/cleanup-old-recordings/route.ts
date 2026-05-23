import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Cron diário de retenção LGPD: apaga gravações cuja retenção (90 dias por
 * padrão, sobrescrito por meetings.retencao_override) venceu.
 *
 * Cron schedule: 0 4 * * * (4h UTC = 1h BRT, baixo tráfego)
 *
 * Autenticado por CRON_SECRET. Idempotente - pode rodar várias vezes.
 *
 * O que apaga:
 *  - Arquivo do Storage bucket meeting-recordings
 *  - Row em meeting_recordings
 *
 * O que MANTÉM:
 *  - public.meetings (titulo, datas, owner - histórico)
 *  - meeting_transcripts (texto da transcrição continua)
 *  - meeting_summaries, meeting_extracted_tasks
 *
 * Isso atende LGPD (gravação = dado sensível) sem perder a memória útil
 * do time.
 */

const MAX_PER_RUN = 50;
const BUCKET = "meeting-recordings";

interface CleanupRow {
  recording_id: string;
  meeting_id: string;
  storage_path: string;
  retain_until_efetiva: string;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Pega da view que já calcula a retenção efetiva
  const { data, error } = await sb
    .from("meeting_recordings_to_cleanup")
    .select("recording_id, meeting_id, storage_path, retain_until_efetiva")
    .order("retain_until_efetiva", { ascending: true })
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

  const resultados: Array<{ recording_id: string; ok: boolean; error?: string }> = [];

  for (const row of rows) {
    try {
      // 1. Apaga do Storage (idempotente - sem erro se já foi deletado)
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([row.storage_path]);

      if (storageError) {
        // Log mas não interrompe - pode ser que o arquivo já não existe
        console.warn(
          `[cleanup-old-recordings] storage delete falhou pra ${row.storage_path}:`,
          storageError.message,
        );
      }

      // 2. Apaga row do DB
      const { error: dbError } = await sb
        .from("meeting_recordings")
        .delete()
        .eq("id", row.recording_id);

      if (dbError) {
        resultados.push({ recording_id: row.recording_id, ok: false, error: dbError.message });
        continue;
      }

      // 3. Atualiza flag no meeting pra UI saber
      await sb
        .from("meetings")
        .update({ recording_ready: false })
        .eq("id", row.meeting_id);

      resultados.push({ recording_id: row.recording_id, ok: true });
    } catch (e) {
      resultados.push({
        recording_id: row.recording_id,
        ok: false,
        error: (e as Error).message,
      });
    }
  }

  if (resultados.some((r) => r.ok)) {
    revalidateTag("meetings", "default");
  }

  return NextResponse.json({
    deleted: resultados.filter((r) => r.ok).length,
    errors: resultados.filter((r) => !r.ok).length,
    resultados,
  });
}
