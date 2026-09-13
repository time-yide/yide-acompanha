"use server";

import { z } from "zod";
import type { Role } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
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

const ROLES_PERMITIDOS: Role[] = [
  "videomaker", "fast_midia", "audiovisual_chefe", "editor",
  "coordenador", "assessor", "adm", "socio",
];

const VIDEO_MIMES = [
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska",
  "video/webm", "video/x-m4v", "video/mpeg",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB

async function requireDriveRole() {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) {
    throw new Error("Sem permissão para upload no Drive");
  }
  return user;
}

const prepareSchema = z.object({
  clientId: z.string().uuid(),
  categoria: z.enum(CATEGORIAS_VIDEO),
  files: z.array(
    z.object({
      name: z.string().min(1),
      size: z.number().positive().max(MAX_FILE_SIZE),
      type: z.string().refine(
        (t) => VIDEO_MIMES.some((m) => t.startsWith(m.split("/")[0])),
        "Tipo de arquivo não é vídeo",
      ),
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
  await requireDriveRole();
  const parsed = prepareSchema.parse(input);

  const supabase = await createClient();
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

const DRIVE_FOLDER_URL_RE = /^https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+$/;

const confirmSchema = z.object({
  clientId: z.string().uuid(),
  categoria: z.enum(CATEGORIAS_VIDEO),
  folderUrl: z.string().regex(DRIVE_FOLDER_URL_RE, "URL de pasta do Drive inválida"),
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
  const actor = await requireDriveRole();
  const parsed = confirmSchema.parse(input);

  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", parsed.clientId)
    .single();
  if (!client) return { error: "Cliente não encontrado" };

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
  await requireDriveRole();
  const supabase = await createClient();
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
