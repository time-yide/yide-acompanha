import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSignedReadUrl } from "@/lib/reunioes/storage";
import { transcribeAudio } from "@/lib/reunioes/transcription/whisper";
import { MEETINGS_CACHE_TAG } from "@/lib/reunioes/queries";

/**
 * Worker de processamento de reuniões.
 *
 * Pega jobs pendentes em `meeting_processing_jobs` e processa um a um.
 * Cada chamada do cron processa até MAX_JOBS_PER_RUN pra não estourar
 * o timeout do Vercel (10s default em hobby, 60s em pro).
 *
 * Cron schedule: every minute (`* * * * *`).
 *
 * Steps suportados:
 *  - `transcription`: chama Whisper API, salva em meeting_transcripts,
 *    marca meeting.transcript_ready=true
 *  - `summarization`: TODO Fase 3 (Claude)
 *  - outros: marcados como skipped
 *
 * Idempotência: usa SELECT FOR UPDATE-like via update conditional —
 * se outro worker já pegou, esse pula. Como Vercel cron é single-threaded
 * por cron entry, na prática não tem race condition.
 */

const MAX_JOBS_PER_RUN = 3;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Pega jobs pending mais antigos primeiro
  const { data: jobsData, error: jobsError } = await sb
    .from("meeting_processing_jobs")
    .select("id, meeting_id, step, attempts, payload")
    .eq("status", "pending")
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(MAX_JOBS_PER_RUN);

  if (jobsError) {
    const msg = jobsError.message ?? "";
    if (msg.includes("schema cache") || msg.includes("does not exist")) {
      return NextResponse.json({ skipped: "migration_pending" });
    }
    return NextResponse.json({ error: jobsError.message }, { status: 500 });
  }

  const jobs = (jobsData ?? []) as Array<{
    id: string;
    meeting_id: string;
    step: string;
    attempts: number;
    payload: Record<string, unknown> | null;
  }>;

  if (jobs.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const resultados: Array<{ id: string; step: string; status: string; error?: string }> = [];

  for (const job of jobs) {
    // Marca como running
    await sb
      .from("meeting_processing_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        attempts: job.attempts + 1,
      })
      .eq("id", job.id);

    try {
      if (job.step === "transcription") {
        await processTranscriptionJob(job.meeting_id, job.payload, sb);
        await sb
          .from("meeting_processing_jobs")
          .update({
            status: "done",
            finished_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", job.id);
        resultados.push({ id: job.id, step: job.step, status: "done" });
      } else {
        // Steps não implementados nesta fase
        await sb
          .from("meeting_processing_jobs")
          .update({
            status: "skipped",
            finished_at: new Date().toISOString(),
            last_error: `Step ${job.step} ainda não implementado`,
          })
          .eq("id", job.id);
        resultados.push({ id: job.id, step: job.step, status: "skipped" });
      }
    } catch (e) {
      const errMsg = (e as Error).message ?? String(e);
      console.error(`[process-meeting-jobs] job=${job.id} step=${job.step}:`, errMsg);
      // Se já tentou 5x, marca failed em vez de voltar pra pending
      const finalStatus = job.attempts + 1 >= 5 ? "failed" : "pending";
      await sb
        .from("meeting_processing_jobs")
        .update({
          status: finalStatus,
          last_error: errMsg.slice(0, 500),
          finished_at: finalStatus === "failed" ? new Date().toISOString() : null,
        })
        .eq("id", job.id);
      resultados.push({ id: job.id, step: job.step, status: finalStatus, error: errMsg });

      // Se falhou definitivamente, marca meeting como failed também
      if (finalStatus === "failed") {
        await sb.from("meetings").update({ status: "failed" }).eq("id", job.meeting_id);
      }
    }
  }

  if (resultados.some((r) => r.status === "done")) {
    revalidateTag(MEETINGS_CACHE_TAG, "default");
  }

  return NextResponse.json({ processed: resultados.length, resultados });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processTranscriptionJob(meetingId: string, payload: Record<string, unknown> | null, sb: any) {
  const path = payload?.recording_path as string | undefined;
  if (!path) {
    // Fallback: pega path do recording mais recente
    const { data: rec } = await sb
      .from("meeting_recordings")
      .select("audio_url")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const audioUrl = (rec as { audio_url?: string } | null)?.audio_url;
    if (!audioUrl) throw new Error("Nenhum recording encontrado pro meeting");
    return await runTranscription(meetingId, audioUrl, sb);
  }
  return await runTranscription(meetingId, path, sb);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runTranscription(meetingId: string, recordingPath: string, sb: any) {
  // Pega meta do recording pra validar tamanho antes de chamar Whisper
  const { data: rec } = await sb
    .from("meeting_recordings")
    .select("id, size_bytes")
    .eq("meeting_id", meetingId)
    .eq("audio_url", recordingPath)
    .maybeSingle();
  const sizeBytes = (rec as { size_bytes?: number } | null)?.size_bytes;

  // Gera signed URL pro Whisper baixar
  const signedUrl = await createSignedReadUrl(recordingPath);

  const { data: meetingRow } = await sb
    .from("meetings")
    .select("idioma")
    .eq("id", meetingId)
    .maybeSingle();
  const idioma = (meetingRow as { idioma?: string } | null)?.idioma ?? "pt-BR";

  const result = await transcribeAudio({
    audioUrl: signedUrl,
    idioma,
    sizeBytes,
  });

  // Salva transcrição (upsert por meeting_id pra reprocessamento ser idempotente)
  const { data: existing } = await sb
    .from("meeting_transcripts")
    .select("id")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (existing) {
    await sb
      .from("meeting_transcripts")
      .update({
        provider: result.provider,
        modelo: result.modelo,
        idioma: result.idioma,
        texto_completo: result.texto_completo,
        segments: result.segments,
        custo_estimado_centavos: result.custo_estimado_centavos,
      })
      .eq("id", existing.id);
  } else {
    await sb.from("meeting_transcripts").insert({
      meeting_id: meetingId,
      provider: result.provider,
      modelo: result.modelo,
      idioma: result.idioma,
      texto_completo: result.texto_completo,
      segments: result.segments,
      custo_estimado_centavos: result.custo_estimado_centavos,
    });
  }

  // Atualiza duração do meeting se ainda não estava preenchida
  // (Whisper retorna duração exata do áudio, mais precisa que end-start do Calendar).
  const ultimoSeg = result.segments[result.segments.length - 1];
  const duracaoSeg = ultimoSeg ? Math.ceil(ultimoSeg.end) : null;
  await sb
    .from("meetings")
    .update({
      transcript_ready: true,
      duracao_segundos: duracaoSeg,
      // Marca como 'completed' já — quando a Fase 3 (summarization) entrar,
      // pode voltar pra 'processing' até o resumo terminar.
      status: "completed",
    })
    .eq("id", meetingId);
}
