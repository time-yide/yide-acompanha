"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { canRecordMeeting } from "./permissions";
import { recordingPath, createSignedUpload } from "./storage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res<T> = T | { error: string };

/**
 * Cria a reunião (source app_recording, status in_progress) e devolve os dados
 * de upload assinado pro browser subir o áudio direto no bucket.
 */
export async function criarReuniaoGravacaoAction(input: {
  clientId: string;
  titulo: string;
  consentiu: boolean;
  online: boolean;
}): Promise<Res<{ meetingId: string; path: string; token: string }>> {
  const user = await requireAuth();
  if (!canRecordMeeting(user.role)) return { error: "Sem permissão pra gravar reunião" };
  if (!input.consentiu) return { error: "É preciso confirmar o aviso de gravação (LGPD)" };
  if (!input.clientId) return { error: "Escolha o cliente" };

  const sb = createServiceRoleClient() as SB;
  const { data: org } = await sb.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const titulo = input.titulo.trim() || `Reunião ${new Date().toLocaleDateString("pt-BR")}`;
  const { data: mt, error } = await sb
    .from("meetings")
    .insert({
      organization_id: org.id,
      owner_user_id: user.id,
      client_id: input.clientId,
      source: "app_recording",
      status: "in_progress",
      titulo,
      starts_at: new Date().toISOString(),
      descricao: input.online ? "Gravada online (áudio da aba + microfone)" : "Gravada presencial (microfone)",
    })
    .select("id")
    .single();
  if (error || !mt) return { error: "Falha ao criar a reunião" };

  const path = recordingPath(org.id, input.clientId, mt.id, "webm");
  const up = await createSignedUpload(path);
  if (!up.ok) return { error: up.error };
  return { meetingId: mt.id, path: up.path, token: up.token };
}

/**
 * Registra a gravação após o upload: cria meeting_recordings, marca
 * recording_ready e fecha o meeting como 'completed' (Fatia 1 não transcreve;
 * a Fatia 2 troca isso por enfileirar transcrição + status 'processing').
 */
export async function registrarGravacaoAction(input: {
  meetingId: string;
  path: string;
  sizeBytes: number;
  duracaoSeg: number;
  formato: string;
}): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!canRecordMeeting(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;

  const { data: mt } = await sb.from("meetings").select("id, owner_user_id, client_id").eq("id", input.meetingId).maybeSingle();
  if (!mt || mt.owner_user_id !== user.id) return { error: "Reunião não encontrada" };

  await sb.from("meeting_recordings").insert({
    meeting_id: input.meetingId,
    audio_url: input.path,
    duracao_segundos: Math.round(input.duracaoSeg) || null,
    size_bytes: input.sizeBytes || null,
    formato: input.formato || "webm",
    captured_at: new Date().toISOString(),
    provider: "manual",
  });

  await sb.from("meetings").update({
    status: "completed",
    recording_ready: true,
    duracao_segundos: Math.round(input.duracaoSeg) || null,
    ends_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", input.meetingId);

  revalidatePath(`/clientes/${mt.client_id}/reunioes`);
  revalidatePath("/reunioes");
  return { ok: true };
}

/** URL assinada pra tocar o áudio de uma reunião (checa visibilidade). */
export async function urlAudioReuniaoAction(meetingId: string): Promise<Res<{ url: string }>> {
  const { podeVerReuniao } = await import("./permissions");
  const { getSignedPlaybackUrl } = await import("./storage");
  const user = await requireAuth();
  const sb = createServiceRoleClient() as SB;
  const { data: mt } = await sb.from("meetings").select("owner_user_id").eq("id", meetingId).maybeSingle();
  if (!mt || !podeVerReuniao(user, { owner_user_id: mt.owner_user_id })) return { error: "Sem acesso" };
  const { data: rec } = await sb.from("meeting_recordings").select("audio_url").eq("meeting_id", meetingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!rec?.audio_url) return { error: "Sem gravação" };
  const url = await getSignedPlaybackUrl(rec.audio_url);
  if (!url) return { error: "Falha ao gerar link" };
  return { url };
}
