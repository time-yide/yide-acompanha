import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { deleteFile } from "@/lib/yori/storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const env = getServerEnv();
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const stats = {
    videos_deleted: 0,
    outputs_deleted: 0,
    orphan_jobs_errored: 0,
  };

  // 1. Deleta vídeos brutos > 24h
  const cutoffVideos = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: oldVideos } = await sb
    .from("yori_jobs")
    .select("id, video_path")
    .lt("created_at", cutoffVideos)
    .not("video_path", "is", null);
  for (const row of (oldVideos ?? []) as Array<{ id: string; video_path: string }>) {
    const ok = await deleteFile("yori-videos", row.video_path);
    if (ok) {
      await sb.from("yori_jobs").update({ video_path: null }).eq("id", row.id);
      stats.videos_deleted++;
    }
  }

  // 2. Deleta outputs > 30 dias
  const cutoffOutputs = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: oldOutputs } = await sb
    .from("yori_jobs")
    .select("id, mp4_path, srt_path, txt_path")
    .lt("completed_at", cutoffOutputs)
    .not("mp4_path", "is", null);
  for (const row of (oldOutputs ?? []) as Array<{ id: string; mp4_path: string; srt_path: string; txt_path: string }>) {
    if (row.mp4_path) await deleteFile("yori-outputs", row.mp4_path);
    if (row.srt_path) await deleteFile("yori-outputs", row.srt_path);
    if (row.txt_path) await deleteFile("yori-outputs", row.txt_path);
    await sb.from("yori_jobs").update({
      mp4_path: null, srt_path: null, txt_path: null,
    }).eq("id", row.id);
    stats.outputs_deleted++;
  }

  // 3. Marca jobs órfãos (stuck > 30min)
  const cutoffOrphans = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: orphans } = await sb
    .from("yori_jobs")
    .select("id")
    .in("status", ["pending", "transcribing", "rendering"])
    .lt("created_at", cutoffOrphans);
  for (const row of (orphans ?? []) as Array<{ id: string }>) {
    await sb.from("yori_jobs").update({
      status: "error",
      error_message: "Job órfão (>30min sem progresso). Tente de novo.",
    }).eq("id", row.id);
    stats.orphan_jobs_errored++;
  }

  return NextResponse.json(stats);
}
