// Cron: processa jobs do Editor IA um step de cada vez.
//
// Pipeline:
// - transcrevendo  -> baixa video, roda Groq Whisper, salva transcricao, status planejando
// - planejando     -> noop por enquanto (PR3 implementa o plano Claude)

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { listJobsToProcess } from "@/lib/editor-ia/queries";
import { downloadFile } from "@/lib/editor-ia/storage";
import { transcribeAudio } from "@/lib/yori/services/groq-whisper";
import type { EditorIaJobRow } from "@/lib/editor-ia/queries";

export const dynamic = "force-dynamic";

type JobWithMeta = EditorIaJobRow & { user_id: string; organization_id: string };

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

async function processJob(job: JobWithMeta): Promise<string> {
  if (job.status === "transcrevendo") return processTranscrevendo(job);
  if (job.status === "planejando") return "noop:aguardando-PR3";
  return `noop:${job.status}`;
}

async function processTranscrevendo(job: JobWithMeta): Promise<string> {
  if (!job.video_url) throw new Error("video_url ausente");

  const buffer = await downloadFile(job.video_url);
  if (!buffer) throw new Error("falha ao baixar video");

  // Deriva o filename do ultimo segmento do path armazenado
  const filename = job.video_url.split("/").pop() ?? "video.mp4";

  const result = await transcribeAudio(buffer, filename);
  if (!result.ok || !result.transcription) {
    throw new Error(result.error ?? "Whisper falhou");
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb
    .from("editor_ia_jobs")
    .update({
      status: "planejando",
      transcricao: result.transcription,
    })
    .eq("id", job.id);

  return "advanced:transcrevendo->planejando";
}

async function markJobError(jobId: string, message: string): Promise<void> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb
    .from("editor_ia_jobs")
    .update({ status: "erro", erro: message.slice(0, 500) })
    .eq("id", jobId);
}
