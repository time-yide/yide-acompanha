// Cron: transcreve reuniões gravadas (job step 'transcription').
// Padrão idêntico ao editor-ia-worker. Roda a cada 2 min.
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { downloadRecording } from "@/lib/reunioes/storage";
import { wordsToSegments } from "@/lib/reunioes/transcript";
import { transcribeAudio } from "@/lib/yori/services/groq-whisper";
import { summarizeMeeting } from "@/lib/reunioes/ai/summarizer";

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
    .in("step", ["transcription", "summarization"])
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(3);

  const results: Array<{ id: string; ok: boolean; msg: string }> = [];
  for (const job of (jobs ?? [])) {
    try {
      const msg = job.step === "summarization" ? await processarResumo(sb, job) : await processarTranscricao(sb, job);
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
    updated_at: new Date().toISOString(),
  }).eq("id", job.meeting_id);

  await sb.from("meeting_processing_jobs").insert({
    meeting_id: job.meeting_id,
    step: "summarization",
    status: "pending",
  });

  return "transcrito";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processarResumo(sb: SB, job: any): Promise<string> {
  await sb.from("meeting_processing_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", job.id);

  const { data: tr } = await sb.from("meeting_transcripts").select("texto_completo").eq("meeting_id", job.meeting_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!tr?.texto_completo) throw new Error("sem transcrição pra resumir");

  const { data: mt } = await sb.from("meetings").select("titulo, client:clients(nome)").eq("id", job.meeting_id).maybeSingle();

  const result = await summarizeMeeting({
    titulo: mt?.titulo ?? "Reunião",
    clienteNome: mt?.client?.nome ?? null,
    textoCompleto: tr.texto_completo,
  });

  if (result.skipped) {
    await sb.from("meeting_processing_jobs").update({ status: "pending", started_at: null }).eq("id", job.id);
    return "skip:anthropic-nao-configurado";
  }
  if (!result.ok || !result.data) throw new Error(result.error ?? "resumo falhou");

  const d = result.data;
  await sb.from("meeting_summaries").insert({
    meeting_id: job.meeting_id,
    provider: "claude",
    modelo: "claude-haiku-4-5",
    resumo_geral: d.resumo_geral || "(sem resumo)",
    decisoes: d.decisoes,
    proximos_passos: d.proximos_passos,
    topicos: [],
    insights: d.insights,
    custo_estimado_centavos: result.custo_estimado_centavos,
  });

  if (d.tarefas.length > 0) {
    await sb.from("meeting_extracted_tasks").insert(
      d.tarefas.map((t) => ({
        meeting_id: job.meeting_id,
        titulo_sugerido: t.titulo,
        descricao_sugerida: t.descricao,
        estado: "sugerida",
        citacao_origem: t.citacao,
        timestamp_origem_segundos: t.timestamp_segundos,
      })),
    );
  }

  await sb.from("meeting_processing_jobs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", job.id);
  await sb.from("meetings").update({
    summary_ready: true,
    insights_ready: true,
    status: "completed",
    updated_at: new Date().toISOString(),
  }).eq("id", job.meeting_id);

  return "resumido";
}
