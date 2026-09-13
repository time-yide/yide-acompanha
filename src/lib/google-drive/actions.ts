"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  driveConfigurado,
  ensureFolderHierarchy,
  initResumableUpload,
  countFilesInFolder,
} from "./client";

export const CATEGORIAS_VIDEO = [
  "Reels",
  "Stories",
  "Institucional",
  "Feed",
  "Depoimento",
  "Outro",
] as const;

export type CategoriaVideo = (typeof CATEGORIAS_VIDEO)[number];

const prepareSchema = z.object({
  clientId: z.string().uuid(),
  categoria: z.enum(CATEGORIAS_VIDEO),
  files: z.array(
    z.object({
      name: z.string().min(1),
      size: z.number().positive(),
      type: z.string().min(1),
    }),
  ).min(1).max(20),
});

export async function isDriveConfigurado(): Promise<boolean> {
  return driveConfigurado();
}

/**
 * Prepara o upload: cria pastas no Drive e retorna URIs resumáveis.
 * O browser faz PUT direto nessas URIs — o arquivo não passa pelo nosso server.
 */
export async function prepareUpload(input: z.input<typeof prepareSchema>) {
  await requireAuth();
  const parsed = prepareSchema.parse(input);

  const supabase = createServiceRoleClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, nome")
    .eq("id", parsed.clientId)
    .single();

  if (!client) return { error: "Cliente não encontrado" };

  const now = new Date();
  const { folderId, folderUrl } = await ensureFolderHierarchy(
    client.nome,
    now,
    parsed.categoria,
  );

  const existingCount = await countFilesInFolder(folderId);

  const uploads: {
    originalName: string;
    driveFileName: string;
    uploadUri: string;
  }[] = [];

  for (let i = 0; i < parsed.files.length; i++) {
    const file = parsed.files[i];
    const seq = existingCount + i + 1;
    const ext = file.name.split(".").pop() ?? "mp4";
    const driveFileName = `video-${String(seq).padStart(2, "0")}.${ext}`;

    const uploadUri = await initResumableUpload(
      driveFileName,
      file.type,
      folderId,
      file.size,
    );

    uploads.push({
      originalName: file.name,
      driveFileName,
      uploadUri,
    });
  }

  return {
    folderId,
    folderUrl,
    clientName: client.nome,
    categoria: parsed.categoria,
    uploads,
  };
}

const confirmSchema = z.object({
  clientId: z.string().uuid(),
  categoria: z.enum(CATEGORIAS_VIDEO),
  folderUrl: z.string().url(),
  files: z.array(
    z.object({
      originalName: z.string(),
      driveFileName: z.string(),
      sizeBytes: z.number(),
    }),
  ),
});

/** Registra no banco que o upload foi feito (pra histórico). */
export async function confirmUpload(input: z.input<typeof confirmSchema>) {
  const actor = await requireAuth();
  const parsed = confirmSchema.parse(input);

  const supabase = await createClient();
  const rows = parsed.files.map((f) => ({
    client_id: parsed.clientId,
    uploaded_by: actor.id,
    categoria: parsed.categoria,
    nome_original: f.originalName,
    nome_drive: f.driveFileName,
    size_bytes: f.sizeBytes,
    folder_url: parsed.folderUrl,
  }));

  const { error } = await supabase.from("drive_uploads").insert(rows);
  if (error) return { error: error.message };

  return { success: true, count: rows.length };
}

/** Lista uploads recentes (pra histórico na tela). */
export async function listRecentUploads(limit = 50) {
  await requireAuth();
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("drive_uploads")
    .select(`
      id, categoria, nome_original, nome_drive, size_bytes, folder_url, created_at,
      client:clients!drive_uploads_client_id_fkey(nome),
      uploader:profiles!drive_uploads_uploaded_by_fkey(nome)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
