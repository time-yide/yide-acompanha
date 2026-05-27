// Cron: Vercel chama a cada 30s. Pega jobs pendentes e avança 1 step de cada.
//
// Pipeline:
// - pending → transcribing      (baixa vídeo, roda Groq Whisper, salva words)
// - transcribing → rendering    (Claude limpa pontuação, gera SRT/TXT, dispara Lambda)
// - rendering → done            (poll Lambda; quando done, baixa MP4 e sobe pro Storage)

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { listJobsToProcess, getTemplate } from "@/lib/yori/queries";
import { downloadFile, uploadOutput, getSignedUrl } from "@/lib/yori/storage";
import { transcribeAudio } from "@/lib/yori/services/groq-whisper";
import { cleanupTranscription } from "@/lib/yori/services/claude-cleanup";
import { startRender, checkRenderProgress } from "@/lib/yori/services/remotion-lambda";
import { buildSrt, buildTxt } from "@/lib/yori/srt-builder";
import type { YoriJob, WhisperWord } from "@/lib/yori/tipos";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const env = getServerEnv();
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobs = await listJobsToProcess(5);
  const results: Array<{ id: string; ok: boolean; status?: string; error?: string }> = [];
  for (const job of jobs) {
    try {
      const status = await processJob(job);
      results.push({ id: job.id, ok: true, status });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ id: job.id, ok: false, error: message });
      await markJobError(job.id, message);
    }
  }
  return NextResponse.json({ processed: results.length, results });
}

async function processJob(job: YoriJob): Promise<string> {
  if (job.status === "pending") return processPending(job);
  if (job.status === "transcribing") return processTranscribing(job);
  if (job.status === "rendering") return processRendering(job);
  return `noop:${job.status}`;
}

async function processPending(job: YoriJob): Promise<string> {
  if (!job.video_path) throw new Error("video_path ausente");
  const buffer = await downloadFile("yori-videos", job.video_path);
  if (!buffer) throw new Error("falha ao baixar vídeo");

  const result = await transcribeAudio(buffer, job.video_filename);
  if (!result.ok || !result.transcription) {
    throw new Error(result.error ?? "Whisper falhou");
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb.from("yori_jobs").update({
    status: "transcribing",
    progress_pct: 33,
    started_at: new Date().toISOString(),
    transcription: result.transcription,
    whisper_cost_brl: result.cost_brl,
  }).eq("id", job.id);

  return "advanced:pending→transcribing";
}

async function processTranscribing(job: YoriJob): Promise<string> {
  if (!job.transcription?.words) throw new Error("transcription ausente");

  const cleanup = await cleanupTranscription(job.transcription.words as WhisperWord[]);
  const words = cleanup.ok ? cleanup.words : (job.transcription.words as WhisperWord[]);

  const srt = buildSrt(words);
  const txt = buildTxt(words);

  const srtUpload = await uploadOutput(job.organization_id, job.user_id, job.id, "srt", srt, "text/plain");
  const txtUpload = await uploadOutput(job.organization_id, job.user_id, job.id, "txt", txt, "text/plain");

  if (!srtUpload.ok || !txtUpload.ok) {
    throw new Error("falha ao subir SRT/TXT");
  }

  const template = await getTemplate(job.template_id);
  if (!template) throw new Error("template não encontrado");

  const videoUrl = job.video_path
    ? await getSignedUrl("yori-videos", job.video_path, 3600)
    : null;
  if (!videoUrl) throw new Error("não consegui gerar signed URL do vídeo");

  const render = await startRender({
    baseTemplate: template.base_template,
    videoUrl,
    words,
    durationSeconds: job.video_duration_seconds ?? 90,
    primary_color: template.primary_color,
    highlight_color: template.highlight_color,
    font_family: template.font_family,
    font_size: template.font_size,
    position: template.position,
    position_y_offset: template.position_y_offset,
    has_shadow: template.has_shadow,
    shadow_intensity: template.shadow_intensity,
    animation: template.animation,
  });
  if (!render.ok || !render.renderId || !render.bucketName) {
    throw new Error(render.error ?? "render Lambda falhou ao iniciar");
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const enrichedTranscription = {
    ...job.transcription,
    _render: { renderId: render.renderId, bucketName: render.bucketName },
  };
  await sb.from("yori_jobs").update({
    status: "rendering",
    progress_pct: 66,
    transcription: enrichedTranscription,
    srt_path: srtUpload.path,
    txt_path: txtUpload.path,
  }).eq("id", job.id);

  return "advanced:transcribing→rendering";
}

async function processRendering(job: YoriJob): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderMeta = (job.transcription as any)?._render;
  if (!renderMeta?.renderId || !renderMeta?.bucketName) {
    throw new Error("render metadata ausente");
  }

  const progress = await checkRenderProgress(renderMeta.renderId, renderMeta.bucketName);
  if (!progress.ok) throw new Error(progress.error ?? "checkRenderProgress falhou");

  if (!progress.done) {
    const supabase = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const pct = 66 + Math.floor(progress.progress * 33);
    await sb.from("yori_jobs").update({ progress_pct: pct }).eq("id", job.id);
    return `still_rendering:${pct}%`;
  }

  if (progress.error) throw new Error(`Lambda erro: ${progress.error}`);
  if (!progress.outputUrl) throw new Error("Lambda terminou sem outputUrl");

  const resp = await fetch(progress.outputUrl);
  if (!resp.ok) throw new Error(`falha ao baixar output: ${resp.statusText}`);
  const mp4Buffer = await resp.arrayBuffer();

  const mp4Upload = await uploadOutput(
    job.organization_id,
    job.user_id,
    job.id,
    "mp4",
    mp4Buffer,
    "video/mp4",
  );
  if (!mp4Upload.ok) throw new Error("falha ao subir MP4 final");

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb.from("yori_jobs").update({
    status: "done",
    progress_pct: 100,
    completed_at: new Date().toISOString(),
    mp4_path: mp4Upload.path,
    lambda_cost_brl: progress.costsBrl,
  }).eq("id", job.id);

  return "advanced:rendering→done";
}

async function markJobError(jobId: string, message: string): Promise<void> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb.from("yori_jobs").update({
    status: "error",
    error_message: message.slice(0, 500),
  }).eq("id", jobId);
}
