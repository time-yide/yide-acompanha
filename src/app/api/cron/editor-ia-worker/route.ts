// Cron: processa jobs do Editor IA um step de cada vez.
//
// Pipeline:
// - transcrevendo  -> baixa video, roda Groq Whisper, salva transcricao, status planejando
// - planejando     -> noop por enquanto (PR3 implementa o plano Claude)

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { listJobsToProcess } from "@/lib/editor-ia/queries";
import { downloadFile, getSignedUrl, uploadOutput, outputPath } from "@/lib/editor-ia/storage";
import { transcribeAudio } from "@/lib/yori/services/groq-whisper";
import { gerarPlanoBase, parametrosDaInstrucao } from "@/lib/editor-ia/services/ia-plano";
import { buildShotstackEdit, submitRender, getRenderStatus } from "@/lib/editor-ia/services/shotstack";
import type { EditorIaJobRow } from "@/lib/editor-ia/queries";
import type { EditPlan } from "@/lib/editor-ia/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  if (job.status === "planejando") return processPlanejando(job);
  if (job.status === "renderizando") return processRenderizando(job);
  return `noop:${job.status}`;
}

async function processTranscrevendo(job: JobWithMeta): Promise<string> {
  if (!job.video_url) throw new Error("video_url ausente");

  const buffer = await downloadFile(job.video_url);
  if (!buffer) throw new Error("falha ao baixar video");

  // Deriva o filename do ultimo segmento do path armazenado
  const filename = job.video_url.split("/").pop() ?? "video.mp4";

  const result = await transcribeAudio(buffer, filename);
  if (result.skipped) {
    // GROQ_API_KEY não configurado — não envenena o job; próxima run vai tentar de novo.
    return "skip:groq-nao-configurado";
  }
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

async function processPlanejando(job: JobWithMeta): Promise<string> {
  const transc = job.transcricao as { words?: import("@/lib/yori/tipos").WhisperWord[] } | null;
  const words = transc?.words ?? [];
  if (words.length === 0) throw new Error("transcrição sem palavras");

  const plano = gerarPlanoBase(words, parametrosDaInstrucao(job.instrucao ?? ""));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  await sb.from("editor_ia_jobs").update({
    edit_plan: plano,
    status: "aguardando_revisao",
  }).eq("id", job.id);
  return "advanced:planejando→aguardando_revisao";
}

async function processRenderizando(job: JobWithMeta): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  if (!job.shotstack_render_id) {
    // Primeira passagem: submeter o render ao Shotstack
    if (!job.video_url) throw new Error("video_url ausente");
    const signed = await getSignedUrl(job.video_url, 4 * 3600);
    if (!signed) throw new Error("falha ao gerar signed URL do vídeo");

    const edit = buildShotstackEdit(job.edit_plan as EditPlan, signed);
    const r = await submitRender(edit);
    if (!r.ok) throw new Error(r.error ?? "submitRender falhou");

    const { error: ridErr } = await sb.from("editor_ia_jobs").update({ shotstack_render_id: r.renderId }).eq("id", job.id);
    if (ridErr) throw new Error(`Falha ao salvar render_id: ${ridErr.message}`);
    return "render:submetido";
  } else {
    // Passagens seguintes: polling do status
    const st = await getRenderStatus(job.shotstack_render_id);

    if (st.status === "done" && st.url) {
      const buf = await (await fetch(st.url)).arrayBuffer();
      const path = outputPath(job.organization_id, job.user_id, job.id);
      const up = await uploadOutput(path, buf, "video/mp4");
      if (!up.ok) throw new Error(`Upload do resultado falhou: ${up.error}`);
      await sb.from("editor_ia_jobs").update({ output_url: path, status: "pronto" }).eq("id", job.id);
      return "render:pronto";
    }

    if (st.status === "failed") throw new Error("render falhou");

    // queued / rendering / unknown — aguarda próximo tick do cron
    return "render:aguardando";
  }
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
