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
  getDriveFile,
  initResumableUpload,
  listFileNamesInFolder,
} from "./client";
import {
  driveFolderUrl,
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
import {
  DRIVE_UPLOAD_TOKEN_TTL_MS,
  assinarSessaoUpload,
  derivarChaveToken,
  verificarSessaoUpload,
} from "./token";

export type PrepareDriveUploadResult =
  | { error: string }
  | {
      /** Token assinado que o confirm exige (cliente/categoria/pasta/arquivos). */
      token: string;
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

function chaveToken(): Buffer {
  const env = getServerEnv();
  return derivarChaveToken(env.GOOGLE_DRIVE_UPLOAD_TOKEN_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Prepara o envio: cria (se faltar) Cliente / Mês / Categoria no Drive e abre
 * uma sessão de upload resumável por arquivo. O navegador sobe cada vídeo
 * direto pro Google — nada do arquivo passa pelo nosso servidor.
 *
 * Devolve um token assinado com tudo que foi decidido aqui; o confirm só
 * aceita esse token.
 */
export async function prepareDriveUpload(input: PrepareDriveUploadInput): Promise<PrepareDriveUploadResult> {
  const user = await requireAuth();
  if (!podeSubirProDrive(user.role)) return { error: "Sem permissão para subir vídeos pro Drive" };
  if (!driveConfigurado()) return { error: "Upload pro Google Drive não está configurado. Cole o link do Drive manualmente." };

  const parsed = prepareDriveUploadSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { clientId, categoria, dataReferencia, files, notificarEditor } = parsed.data;

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
          mimeType: mimeVideo(file.name),
          folderId,
          fileSize: file.size,
          origin,
        });
        return { originalName: file.name, driveFileName, uploadUri };
      }),
    );

    const token = assinarSessaoUpload(
      {
        v: 1,
        uid: user.id,
        clientId: client.id,
        categoria,
        folderId,
        notificarEditor,
        arquivos: uploads.map((u) => ({ driveFileName: u.driveFileName, originalName: u.originalName })),
        exp: Date.now() + DRIVE_UPLOAD_TOKEN_TTL_MS,
      },
      chaveToken(),
    );

    return {
      token,
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
 *
 * Cliente, categoria, pasta e nomes esperados vêm do token assinado no
 * prepare. Cada arquivo é conferido no Drive (existe, nome bate e está na
 * pasta da sessão) antes de virar linha no histórico.
 */
export async function confirmDriveUpload(input: ConfirmDriveUploadInput): Promise<{ error?: string; count?: number }> {
  const user = await requireAuth();
  if (!podeSubirProDrive(user.role)) return { error: "Sem permissão" };
  if (!driveConfigurado()) return { error: "Upload pro Google Drive não está configurado" };

  const parsed = confirmDriveUploadSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const verif = verificarSessaoUpload(parsed.data.token, chaveToken(), { uid: user.id });
  if (!verif.ok) return { error: "Sessão de envio inválida ou expirada" };
  const sessao = verif.sessao;
  const folderUrl = driveFolderUrl(sessao.folderId);

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, nome, editor_id")
    .eq("id", sessao.clientId)
    .maybeSingle();
  if (!client) return { error: "Cliente não encontrado" };

  const esperados = new Map(sessao.arquivos.map((a) => [a.driveFileName, a.originalName]));
  const vistos = new Set<string>();
  const pedidos = parsed.data.files.filter((f) => {
    if (!esperados.has(f.driveFileName) || vistos.has(f.driveFileName)) return false;
    vistos.add(f.driveFileName);
    return true;
  });

  const conferidos = (
    await Promise.all(
      pedidos.map(async (f) => {
        const info = await getDriveFile(f.driveFileId);
        if (!info || info.trashed || info.name !== f.driveFileName || !info.parents.includes(sessao.folderId)) return null;
        return { ...f, sizeBytes: info.size };
      }),
    )
  ).filter((f): f is NonNullable<typeof f> => f !== null);

  if (conferidos.length === 0) return { error: "Nenhum arquivo conferido no Drive" };

  // Sem policy de INSERT na tabela: grava com service role, só com dados
  // derivados do token + conferidos no Drive. drive_file_id é único, então
  // reenviar o mesmo confirm não duplica histórico nem notificação.
  const { data: inseridos, error } = await createServiceRoleClient()
    .from("drive_uploads")
    .upsert(
      conferidos.map((f) => ({
        client_id: client.id,
        uploaded_by: user.id,
        categoria: sessao.categoria,
        nome_original: esperados.get(f.driveFileName) ?? f.driveFileName,
        nome_drive: f.driveFileName,
        drive_file_id: f.driveFileId,
        size_bytes: f.sizeBytes,
        folder_url: folderUrl,
      })),
      { onConflict: "drive_file_id", ignoreDuplicates: true },
    )
    .select("id");
  // Histórico é secundário: os vídeos já estão no Drive. Não trava o fluxo.
  if (error) console.error("[google-drive/confirm] insert drive_uploads:", error.message);
  const novos = inseridos?.length ?? 0;

  if (sessao.notificarEditor && client.editor_id && novos > 0) {
    await notifyDriveUploadPronto({
      editorId: client.editor_id,
      uploaderId: user.id,
      uploaderName: user.nome,
      clientName: client.nome,
      categoria: nomePastaCategoria(sessao.categoria),
      fileCount: novos,
      folderUrl,
    }).catch(() => {});
  }

  return { count: conferidos.length };
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
 * gestão vê clientes visíveis/unidade; demais, só os próprios envios ou de
 * clientes onde é o editor). Vazio se a tabela não existir.
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
    // Redundante com a policy (que já filtra), mantido em sincronia com ela.
    const { data: meus } = await supabase.from("clients").select("id").eq("editor_id", escopo.userId);
    const clientIds = (meus ?? []).map((c) => c.id);
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
