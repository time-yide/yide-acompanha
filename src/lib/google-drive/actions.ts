"use server";

import { headers } from "next/headers";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { notifyDriveUploadPronto } from "@/lib/notificacoes/trigger";
import {
  driveConfigurado,
  ensureFolderHierarchy,
  initResumableUpload,
  listFileNamesInFolder,
} from "./client";
import {
  mimeVideo,
  nomeArquivoDrive,
  nomePastaCategoria,
  nomePastaCliente,
  nomePastaMes,
  proximaSequencia,
} from "./naming";
import {
  confirmDriveUploadSchema,
  escopoHistoricoDrive,
  podeSubirProDrive,
  prepareDriveUploadSchema,
  type ConfirmDriveUploadInput,
  type PrepareDriveUploadInput,
} from "./schema";

export type PrepareDriveUploadResult =
  | { error: string }
  | {
      folderUrl: string;
      mesFolderUrl: string;
      caminho: string;
      uploads: Array<{ originalName: string; driveFileName: string; uploadUri: string }>;
    };

/** Origem do navegador que vai fazer o PUT (CORS da sessão resumável). */
async function origemDoNavegador(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  return new URL(getServerEnv().NEXT_PUBLIC_APP_URL).origin;
}

/**
 * Prepara o envio: cria (se faltar) Cliente / Mês / Categoria no Drive e abre
 * uma sessão de upload resumável por arquivo. O navegador sobe cada vídeo
 * direto pro Google — nada do arquivo passa pelo nosso servidor.
 */
export async function prepareDriveUpload(input: PrepareDriveUploadInput): Promise<PrepareDriveUploadResult> {
  const user = await requireAuth();
  if (!podeSubirProDrive(user.role)) return { error: "Sem permissão para subir vídeos pro Drive" };
  if (!driveConfigurado()) return { error: "Upload pro Google Drive não está configurado. Cole o link do Drive manualmente." };

  const parsed = prepareDriveUploadSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { clientId, categoria, dataReferencia, files } = parsed.data;

  // Client da sessão (RLS de clients por unidade): cliente de outra unidade
  // volta null e o envio é recusado antes de mexer no Drive.
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, nome")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { error: "Cliente não encontrado" };

  try {
    const pastaCliente = nomePastaCliente(client.nome);
    const pastaMes = nomePastaMes(dataReferencia);
    const pastaCategoria = nomePastaCategoria(categoria);
    const { folderId, folderUrl, mesFolderUrl } = await ensureFolderHierarchy(pastaCliente, pastaMes, pastaCategoria);

    const existentes = await listFileNamesInFolder(folderId);
    const inicio = proximaSequencia(existentes);
    const origin = await origemDoNavegador();

    const uploads = await Promise.all(
      files.map(async (file, i) => {
        const driveFileName = nomeArquivoDrive(inicio + i, file.name);
        const uploadUri = await initResumableUpload({
          fileName: driveFileName,
          mimeType: mimeVideo(file.name, file.type),
          folderId,
          fileSize: file.size,
          origin,
        });
        return { originalName: file.name, driveFileName, uploadUri };
      }),
    );

    return {
      folderUrl,
      mesFolderUrl,
      caminho: `${pastaCliente} / ${pastaMes} / ${pastaCategoria}`,
      uploads,
    };
  } catch (err) {
    console.error("[google-drive/prepare]", err instanceof Error ? err.message : err);
    return { error: "Não foi possível preparar o envio pro Drive. Tente de novo ou cole o link manualmente." };
  }
}

/**
 * Registra os vídeos que subiram (histórico) e, na página avulsa, avisa o
 * editor do cliente. Na entrega de captação o aviso já sai pela própria entrega.
 */
export async function confirmDriveUpload(input: ConfirmDriveUploadInput): Promise<{ error?: string; count?: number }> {
  const user = await requireAuth();
  if (!podeSubirProDrive(user.role)) return { error: "Sem permissão" };

  const parsed = confirmDriveUploadSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { clientId, categoria, folderUrl, files, notificarEditor } = parsed.data;

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, nome, editor_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { error: "Cliente não encontrado" };

  // Sem policy de INSERT na tabela: grava com service role, só depois de
  // validar papel, cliente (lido acima com o client da sessão, sob RLS) e URL.
  const { error } = await createServiceRoleClient().from("drive_uploads").insert(
    files.map((f) => ({
      client_id: clientId,
      uploaded_by: user.id,
      categoria,
      nome_original: f.originalName,
      nome_drive: f.driveFileName,
      drive_file_id: f.driveFileId ?? null,
      size_bytes: f.sizeBytes,
      folder_url: folderUrl,
    })),
  );
  // Histórico é secundário: os vídeos já estão no Drive. Não trava o fluxo.
  if (error) console.error("[google-drive/confirm] insert drive_uploads:", error.message);

  if (notificarEditor && client.editor_id) {
    await notifyDriveUploadPronto({
      editorId: client.editor_id,
      uploaderId: user.id,
      uploaderName: user.nome,
      clientName: client.nome,
      categoria: nomePastaCategoria(categoria),
      fileCount: files.length,
      folderUrl,
    }).catch(() => {});
  }

  return { count: files.length };
}

export interface DriveUploadRecente {
  id: string;
  categoria: string;
  nome_original: string;
  nome_drive: string;
  size_bytes: number | null;
  folder_url: string;
  created_at: string;
  client_nome: string | null;
  uploader_nome: string | null;
}

/**
 * Últimos envios (histórico da página avulsa). Lê com o client da sessão (RLS:
 * só clientes visíveis pro usuário, ou seja, da unidade dele) e restringe
 * videomaker/fast_midia/editor aos próprios envios. Vazio se a tabela não existir.
 */
export async function listRecentDriveUploads(limit = 30): Promise<DriveUploadRecente[]> {
  const user = await requireAuth();
  const escopo = escopoHistoricoDrive(user.role, user.id);
  if (escopo.tipo === "nenhum") return [];

  const supabase = await createClient();
  let query = supabase
    .from("drive_uploads")
    .select("id, categoria, nome_original, nome_drive, size_bytes, folder_url, created_at, client:clients(nome), uploader:profiles(nome)")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (escopo.tipo === "proprios") {
    let clientIds: string[] = [];
    if (escopo.incluiClientesDoEditor) {
      const { data: meus } = await supabase.from("clients").select("id").eq("editor_id", escopo.userId);
      clientIds = (meus ?? []).map((c) => c.id);
    }
    query = clientIds.length > 0
      ? query.or(`uploaded_by.eq.${escopo.userId},client_id.in.(${clientIds.join(",")})`)
      : query.eq("uploaded_by", escopo.userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[google-drive/recentes]", error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string; categoria: string; nome_original: string; nome_drive: string;
      size_bytes: number | null; folder_url: string; created_at: string;
      client: { nome: string } | null; uploader: { nome: string } | null;
    };
    return {
      id: row.id,
      categoria: row.categoria,
      nome_original: row.nome_original,
      nome_drive: row.nome_drive,
      size_bytes: row.size_bytes,
      folder_url: row.folder_url,
      created_at: row.created_at,
      client_nome: row.client?.nome ?? null,
      uploader_nome: row.uploader?.nome ?? null,
    };
  });
}
