// Cron: transcreve reuniões gravadas (job step 'transcription').
// Padrão idêntico ao editor-ia-worker. Roda a cada 2 min.
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { downloadRecording } from "@/lib/reunioes/storage";
import { wordsToSegments } from "@/lib/reunioes/transcript";
import { transcribeAudio } from "@/lib/yori/services/groq-whisper";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const env = getServerEnv();
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = createServiceRoleClient() as SB;
  const { data: jobs } = await sb
    .from("meeting_processing_jobs")
    .select("id, meeting_id, step, status, attempts")
    .eq("step", "transcription")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(3);

  const results: Array<{ id: string; ok: boolean; msg: string }> = [];
  for (const job of (jobs ?? [])) {
    try {
      const msg = await processarTranscricao(sb, job);
      results.push({ id: job.id, ok: true, msg });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await sb.from("meeting_processing_jobs").update({
        status: "failed", last_error: message, attempts: (job.attempts ?? 0) + 1, finished_at: new Date().toISOString(),
      }).eq("id", job.id);
      await sb.from("meetings").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", job.meeting_id);
      results.push({ id: job.id, ok: false, msg: message });
    }
  }
  return NextResponse.json({ processed: results.length, results });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processarTranscricao(sb: SB, job: any): Promise<string> {
  await sb.from("meeting_processing_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", job.id);

  const { data: rec } = await sb
    .from("meeting_recordings")
    .select("audio_url")
    .eq("meeting_id", job.meeting_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!rec?.audio_url) throw new Error("gravação sem audio_url");

  const buffer = await downloadRecording(rec.audio_url);
  if (!buffer) throw new Error("falha ao baixar áudio do storage");

  const filename = rec.audio_url.split("/").pop() ?? "audio.webm";
  const result = await transcribeAudio(buffer, filename);

  if (result.skipped) {
    await sb.from("meeting_processing_jobs").update({ status: "pending", started_at: null }).eq("id", job.id);
    return "skip:groq-nao-configurado";
  }
  if (!result.ok || !result.transcription) throw new Error(result.error ?? "Whisper falhou");

  const t = result.transcription;
  const segments = wordsToSegments(t.words ?? [], 12);

  await sb.from("meeting_transcripts").insert({
    meeting_id: job.meeting_id,
    provider: "whisper",
    modelo: "whisper-large-v3",
    idioma: t.language || "pt-BR",
    texto_completo: t.text,
    segments,
    custo_estimado_centavos: Math.round((result.cost_brl || 0) * 100),
  });

  await sb.from("meeting_processing_jobs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", job.id);
  await sb.from("meetings").update({
    transcript_ready: true,
    status: "completed",
    updated_at: new Date().toISOString(),
  }).eq("id", job.meeting_id);

  return "transcrito";
}
