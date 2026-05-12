"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  WHISPER_MAX_BYTES,
  buildRecordingPath,
  createSignedUploadUrl,
  getRecordingMetadata,
} from "./storage";
import { MEETINGS_CACHE_TAG } from "./queries";

// ─── Criar reunião manualmente ─────────────────────────────────────────────

const novaReuniaoSchema = z.object({
  titulo: z.string().min(2, "Título muito curto").max(180),
  descricao: z.string().max(2000).optional().nullable(),
  starts_at: z.string().min(1, "Data/hora obrigatória"),
  ends_at: z.string().optional().nullable(),
  tags: z.array(z.string()).max(10).optional().default([]),
});

export async function criarReuniaoManualAction(formData: FormData): Promise<
  { id: string } | { error: string }
> {
  const user = await requireAuth();

  const parsed = novaReuniaoSchema.safeParse({
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao") || null,
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at") || null,
    tags: formData.getAll("tags").map(String).filter(Boolean),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: profileRow } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = (profileRow as { organization_id?: string } | null)?.organization_id;
  if (!orgId) return { error: "Organização não encontrada no seu perfil" };

  const startsAtIso = new Date(parsed.data.starts_at).toISOString();
  const endsAtIso = parsed.data.ends_at ? new Date(parsed.data.ends_at).toISOString() : null;
  const duracaoSeg = endsAtIso
    ? Math.max(0, Math.floor((new Date(endsAtIso).getTime() - new Date(startsAtIso).getTime()) / 1000))
    : null;

  const { data: created, error } = await sb
    .from("meetings")
    .insert({
      organization_id: orgId,
      owner_user_id: user.id,
      source: "manual_upload" as const,
      status: "scheduled" as const,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao ?? null,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      duracao_segundos: duracaoSeg,
      idioma: "pt-BR",
      tags: parsed.data.tags ?? [],
    })
    .select("id")
    .single();

  if (error || !created) {
    const msg = error?.message ?? "";
    if (msg.includes("schema cache") || msg.includes("does not exist")) {
      return { error: "Schema do módulo Reuniões não foi aplicado no banco. Avise o admin." };
    }
    return { error: error?.message ?? "Falha ao criar reunião" };
  }

  await logAudit({
    entidade: "meetings",
    entidade_id: created.id,
    acao: "create",
    dados_depois: { titulo: parsed.data.titulo, source: "manual_upload" },
    ator_id: user.id,
  });

  revalidatePath("/reunioes");
  revalidateTag(MEETINGS_CACHE_TAG, "default");
  return { id: created.id };
}

// ─── Upload de áudio ───────────────────────────────────────────────────────

const gerarUploadUrlSchema = z.object({
  meeting_id: z.string().uuid(),
  filename: z.string().min(1).max(255),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().positive(),
});

/**
 * Passo 1 do upload: client pede signed URL pro Supabase Storage.
 * Validamos meeting existe + user tem acesso + arquivo válido.
 *
 * Cliente recebe URL + path, faz PUT direto no Supabase com o arquivo,
 * depois chama `registrarUploadConcluidoAction` (passo 2) pra criar
 * o registro em meeting_recordings + job de transcrição.
 */
export async function gerarUploadUrlAction(input: {
  meeting_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}): Promise<
  | { url: string; path: string; token: string }
  | { error: string }
> {
  const user = await requireAuth();

  const parsed = gerarUploadUrlSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (!ALLOWED_MIME_TYPES.includes(parsed.data.mime_type as typeof ALLOWED_MIME_TYPES[number])) {
    return { error: `Tipo de arquivo não suportado: ${parsed.data.mime_type}` };
  }
  if (parsed.data.size_bytes > MAX_FILE_SIZE_BYTES) {
    return {
      error: `Arquivo grande demais (${(parsed.data.size_bytes / 1024 / 1024).toFixed(1)}MB). Limite: 100MB.`,
    };
  }
  if (parsed.data.size_bytes > WHISPER_MAX_BYTES) {
    return {
      error: `Arquivo tem ${(parsed.data.size_bytes / 1024 / 1024).toFixed(1)}MB. Whisper API limita 25MB. Comprima o áudio (MP3 64kbps mono fica em <25MB pra reuniões até 1h).`,
    };
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: meeting } = await sb
    .from("meetings")
    .select("id, organization_id, owner_user_id")
    .eq("id", parsed.data.meeting_id)
    .maybeSingle();

  if (!meeting) return { error: "Reunião não encontrada" };

  // Permissão: owner do meeting + adm/socio
  const isOwner = (meeting as { owner_user_id: string }).owner_user_id === user.id;
  const isAdmin = ["adm", "socio"].includes(user.role);
  if (!isOwner && !isAdmin) {
    return { error: "Você não tem permissão pra subir áudio nesta reunião" };
  }

  const path = buildRecordingPath(
    (meeting as { organization_id: string }).organization_id,
    parsed.data.meeting_id,
    parsed.data.filename,
  );

  try {
    const signed = await createSignedUploadUrl(path);
    return { url: signed.url, path: signed.path, token: signed.token };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const registrarUploadSchema = z.object({
  meeting_id: z.string().uuid(),
  path: z.string().min(1),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().positive(),
  filename: z.string().min(1),
});

/**
 * Passo 2 do upload: registra o arquivo em meeting_recordings + cria job
 * de transcrição.
 */
export async function registrarUploadConcluidoAction(input: {
  meeting_id: string;
  path: string;
  mime_type: string;
  size_bytes: number;
  filename: string;
}): Promise<{ recording_id: string } | { error: string }> {
  const user = await requireAuth();
  const parsed = registrarUploadSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: meeting } = await sb
    .from("meetings")
    .select("id, owner_user_id, duracao_segundos")
    .eq("id", parsed.data.meeting_id)
    .maybeSingle();
  if (!meeting) return { error: "Reunião não encontrada" };

  const isOwner = (meeting as { owner_user_id: string }).owner_user_id === user.id;
  const isAdmin = ["adm", "socio"].includes(user.role);
  if (!isOwner && !isAdmin) {
    return { error: "Sem permissão" };
  }

  // Valida que o arquivo realmente subiu (pra não ficar registro órfão).
  const meta = await getRecordingMetadata(parsed.data.path);
  if (!meta) {
    return { error: "Arquivo não encontrado no storage. Tente upload de novo." };
  }

  const formato = parsed.data.mime_type.split("/")[1] ?? null;

  const { data: recording, error: recError } = await sb
    .from("meeting_recordings")
    .insert({
      meeting_id: parsed.data.meeting_id,
      audio_url: parsed.data.path, // guardamos path, signed URL é gerada sob demanda
      duracao_segundos: (meeting as { duracao_segundos: number | null }).duracao_segundos,
      size_bytes: meta.size,
      formato,
      provider: "manual",
      captured_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (recError || !recording) {
    return { error: recError?.message ?? "Falha ao registrar gravação" };
  }

  // Marca meeting como "processing" + recording_ready=true
  await sb
    .from("meetings")
    .update({ status: "processing", recording_ready: true })
    .eq("id", parsed.data.meeting_id);

  // Cria job de transcrição
  await sb.from("meeting_processing_jobs").insert({
    meeting_id: parsed.data.meeting_id,
    step: "transcription" as const,
    status: "pending" as const,
    payload: { recording_path: parsed.data.path },
  });

  await logAudit({
    entidade: "meeting_recordings",
    entidade_id: recording.id,
    acao: "create",
    dados_depois: {
      meeting_id: parsed.data.meeting_id,
      path: parsed.data.path,
      size_bytes: meta.size,
    },
    ator_id: user.id,
  });

  revalidatePath(`/reunioes/${parsed.data.meeting_id}`);
  revalidatePath("/reunioes");
  revalidateTag(MEETINGS_CACHE_TAG, "default");

  return { recording_id: recording.id };
}
